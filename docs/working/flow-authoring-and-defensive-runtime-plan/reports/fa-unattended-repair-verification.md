# t108 — a repair's own product is now judged, with nobody watching

All source changes are in **FluxIQ Core**, in the worktree `F:/fxwork/t108/!FluxIQ`
on `task/t108-unattended-repair-verification`. The web-extension worktree
`F:/fxwork/t108/!FluxIQWebExtension` has **no source change** — only this report.
No Lab run, campaign or provider call was started. Nothing was committed or
pushed.

## Outcome

Done. A run that fails, is repaired by the model, and re-runs now has the result
of that retry judged by a real provider call, with no person present, no
execution grant anywhere in the chain, and no `manual_approval` implied. A
repaired run that produces a second wrong answer is now **failed** rather than
reported as a success.

One correction to the brief's premise comes first, because it changes what the
work was.

## The circularity was already half-broken, and nobody had noticed

The brief states the chain as `resolveProvider` needs a grant → any grant forces
`manual_approval` → the promotion gate records `autoApply: false` →
`decideAutomationStudioAdaptiveRetry` answers `null`. The first link was **no
longer true**. t102 (`5615fee`, merged before t104) added
`resolveStandingProvider` to `resolveAutomationStudioResultCheckProvider`, and
`service.ts`'s `resultPorts.resolveProvider` already passes it whenever the
service was constructed with a `resultCheckProviderResolver`. t104's finding read
the `resolveGrantedProvider` branch of that literal and missed the standing one
beside it.

I proved this before changing anything, by building the case t104's test had not:
the same repaired-and-retried run, with a standing authorization stored in the
Flow's settings and a host resolver wired. Observed, first run, unchanged code:

```
adaptiveRetry:      {"attempted":true,"status":"succeeded","attemptCount":1}
approvalDecision:   {"mode":"auto","autoApply":true,"requiresManualApproval":false,…}
resultVerification: {"status":"confirmed","performed":true,"verdict":"answers","basis":"model",…}
standingRequests:   [{"keyId":"key.deepseek","maxEstimatedCostUsd":0.05,"authorizedByUserId":"user.aiden"}]
standingCalls:      ["loop_verification"]
resultCheck:        undefined
```

So the provider call was already reachable. **The reason nobody knew is that no
test in either repository had ever driven the standing resolver through the
service** — `grep -rln "resultCheckProviderResolver"` over `packages/fluxiq/src`
returned exactly two files, `service.ts` and `_shared/runtime.ts`, and no test.
The belief that the path was dead survived because nothing exercised it.

That last line, `resultCheck: undefined`, is the real defect, and it is worse
than it looks.

## What was actually broken

Both retried-session call sites called `verifyAutomationStudioRuntimeSessionResult`
**without** the run's `resultCheck` decision. Everything downstream of that
argument is gated on it:

- `recordedResultCheck` returns `undefined`, so no `resultCheck` lands on the
  session, the run detail, or the run *summary*;
- `runResultVerificationStatus` in `runtime-stream-store.ts` reads
  `summary.metadata.resultCheck.checked !== true` and writes **null** into
  `result_verification_status`, and `runResultCheckEpoch` falls back to epoch 1;
- so `readResultCheckState` never counts the check: `checksPassed` does not
  rise, `lastCheckedOrdinal` and `lastStatus` stay as they were, and the
  schedule's own "after a refutation, check the next run too" rule can never
  fire from a repaired run;
- and `sayResultCheck` — `if (input.resultCheck && outcome.performed === true)`
  — said nothing at all, so a repair whose product was judged **wrong** reached
  the person's conversation thread not at all.

In short: the money was spent, the verdict was reached, and the record of both
was discarded. A repair could make things no better and nothing reported it —
which is the sentence in the brief, arrived at by a different route than the one
the brief expected.

There was a second gap beside it. The decision *when a run starts* answers "is
run 4 one the sequence checks?", taken before anyone knows a repair will happen.
Under the default schedule a repaired run is judged only if its ordinal happens
to fall on 1, 2, 3, 8, 33… — so gate 4 fired by luck.

## The change

Six files in Core, and `service.ts` is unchanged in length (4583 lines, its
ratchet is 4584).

1. **`result-check-schedule/decide.ts`** — a third rule outside the ordinal
   sequence: `repairedThisRun` checks this run whatever the sequence says. It
   sits **below** the person's two switches, so `enabled: false` and the `never`
   shape still win; a repair is not a reason to overrule someone who said not to
   spend their money. New code `core.check.after_repair` in `contracts.ts`.
2. **`policy.ts` / `resolve.ts`** — the schedule interface carries the flag, so
   every shape gets the rule and a sixth shape inherits it. It is handed in
   beside the state rather than read off it, because `state` is derived from
   *finished* runs and this run is the one being decided about.
3. **`service/runtime-adaptation/result-check.ts`** — `automationStudioRunResultCheck`
   takes the flag, and a new `automationStudioRepairedRunResultCheck` re-takes
   the decision for a retried run. It redeems **the same authorization on the
   same terms**: expiry, per-call ceiling and total ceiling all still bind, and
   an absent authorization still refuses. Only the schedule's sequence is
   overruled.
4. **`service.ts`** — both retried-session call sites replace `runResultCheck`
   with the repaired-run decision and pass it to the verification.
   `resolveProvider` reads that same variable lazily, so the redemption the
   verification spends is the one the record then carries. The retry keeps the
   run's id (`retryRuntimeSessionAfterAutoAppliedPatch` spreads `input.session`),
   so this is one decision and one record per run, never two.

The epoch is deliberately left as the one the run *started* at, not the
post-repair revision: `readResultCheckState` counts finished runs at an epoch,
and filing a run under an epoch it did not run in would make it ordinal 1 of a
window it was never in. A landed repair still bumps `flows.graph_revision`, so
the next run reads an empty state at the new epoch and the initial window
re-opens — the documented behaviour, unchanged.

## What is now true, with the observed output

`src/programs/automation-studio/runtime/tests/service-adaptation/tests/unattended-retry-verification.test.ts`
(new, 8 tests, real service, real run, no grant). Each of the brief's four
requirements, in order:

**1. A retried session is verified, spending a call, with nobody present.**

```
✓ is judged under the Flow's standing authorization, spending a call with no grant anywhere
```
It asserts `standingRequests == [{keyId: "key.deepseek", maxEstimatedCostUsd: 0.05,
authorizedByUserId: "user.aiden"}]`, `standingCalls == ["loop_verification"]`,
every provider call made with `hasGrant === false`, `resultVerification` =
`{status: "confirmed", performed: true, verdict: "answers", basis: "model"}`, and
`resultCheck` = `{checked: true, code: "core.check.after_repair", status:
"confirmed", epoch: 1}` on **both** the session and the run summary. The Flow's
schedule in that test is `fixed_interval, initialRunCount 0, interval 5`, which
checks runs 5, 10, 15 — so run 1 is checked *because it repaired itself* and for
no other reason.

And the gate now bites:
```
✓ fails the run when the repair produced another wrong answer, which is the whole point of the gate
```
Two agreeing refusals from the standing authorization
(`standingCalls == ["loop_verification", "loop_verification"]`),
`resultVerification` = `{status: "refuted", verdict: "does_not_answer", calls: 2}`,
`resultCheck.status == "refuted"`, and `run.status == "failed"` although every
step of the retry succeeded.

**2. Redeeming it does not set `autoApply: false`; the adaptive retry still runs.**

```
✓ carries no manual approval anywhere in the chain that produced it
```
It reads each link where it is written, rather than assuming: the patch receipt's
`approvalDecision` is `{mode: "auto", autoApply: true, requiresManualApproval:
false}`; `runtimeAdaptationContext.approvalMode` is not `"manual"` and the whole
serialized context contains no `manual_approval`; `adaptiveRetry.attempted` is
true; and the verification call still happened. The link is broken by
construction rather than by an edit: nothing in `result-check-authorization/`
touches `input.llmExecution`, which is the only thing `runRuntimeSession` turns
into `adaptiveMode: "manual_approval"`.

**3. A person's grant behaves exactly as today.**

```
✓ still judges the result itself, and the standing authorization is never reached
✓ still forces manual approval, so a granted run still does not retry
```
With a `verify_result` grant on a clean run the granted provider makes the
`loop_verification` call and `standingRequests == []`, although an authorization
is stored. With a `diagnose_and_adapt` grant the run is still forced to manual
approval (`runtimeAdaptationContext.approvalMode == "manual"`), still has no
`adaptiveRetry`, and still never reaches the standing path. Both are today's
behaviour, now pinned.

**4. Scope, ceiling and expiry still bind, and refuse cleanly.**

```
✓ refuses cleanly when the standing authorization has expired, rather than falling back to anything wider
✓ asks nobody and spends nothing when nobody authorized checking at all
✓ does not overrule the person's own off switch, however much it repaired itself
```
Expired: `standingRequests == []`, `standingCalls == []`, `resultCheck ==
{checked: false, code: "core.check.authorization_expired", status: "unverified"}`,
`resultVerification == {performed: false, code: "core.result.no_model_available"}`,
run still `succeeded` — never `confirmed`. Absent:
`core.check.authorization_absent`. Checking turned off: `core.check.disabled`, no
key asked for. Scope and the exhausted ceiling are held at the unit level, on the
repaired path specifically, in
`service/runtime-adaptation/tests/result-check.test.ts`
(`core.check.authorization_exhausted` at `spentUsd: 0.99` of a `$1` ceiling; the
task kind is not parameterised anywhere, so `redeem.ts` can only ever pass
`loop_verification`).

### Mutation-checked, both halves

- Deleting the `repairedThisRun` branch from `decide.ts` → **7 failures**
  across the three files, e.g. `expected [] to deeply equal [ 'loop_verification' ]`
  and `expected { check: false, …(3) } to match object { check: true, …(2) }`.
- Deleting the `resultCheck:` argument from both retried-session call sites in
  `service.ts` → **4 failures**, each `expected undefined to match object
  { checked: … }`.

Both mutations were reverted and the suite re-run green.

## Commands run and observed results

- `pnpm --filter fluxiq exec vitest run …/unattended-retry-verification.test.ts`
  → **8 passed**, 16.1s.
- `pnpm --filter fluxiq exec vitest run …/result-check.test.ts …/schedule.test.ts`
  → **31 passed** (15 + 16).
- `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime`
  → **2311 passed, 1 skipped, 1 failed** — `deepseek-bootstrap-exploration.test.ts
  > asks again after a decision that runs past its deadline`, a deadline test
  that took 10.7s under a 232-file parallel run. Re-run alone: **8 passed**,
  same test 5.8s. Load, not a regression; it is untouched by this change.
- `pnpm --filter fluxiq exec tsc --noEmit` → clean.
- `pnpm check` in `F:/fxwork/t108/!FluxIQ` → **exit 0**
  (`structure-audit: passed (179 warning(s), 360 baselined)`, all four package
  `check: Done`).
- `pnpm check` in `F:/fxwork/t108/!FluxIQWebExtension` → **exit 0**, all packages
  `check: Done`.
- `pnpm --filter @fluxiq-web-extension/test-runner test` → **1335 pass, 0 fail**.
- `pnpm --filter @fluxiq-web-extension/domain test` → **768 pass, 0 fail**.

No Lab run, campaign or provider call was made; the mock providers above are the
only models involved.

## One pre-existing red test, fixed

`result-check-authorization/tests/provider.test.ts` was failing on this branch
before I touched anything: t105 moved the default model to `deepseek-flash` and
did not update t102's hard-coded `deepseek-chat`.

```
- "model": "deepseek-chat"
+ "model": "deepseek-flash"
```

It now reads `AUTOMATION_STUDIO_DEEPSEEK_DEFAULT_MODEL` from the `llm` barrel, so
the next rename cannot leave it stale. (The first attempt imported
`../../llm/deepseek/models.ts` directly and the structure audit refused it —
`[imports] 1 import(s) reach into another directory's files instead of its
barrel` — which is the audit doing its job.)

## What Core's paired working document should record

- **The standing authorization reaches the retried-session verification, and did
  so from t102.** The claim in `fa-repair-sees-parameters-and-routing.md`'s
  second numbered finding — "a provider-backed verification of a retried session
  is unreachable as the code stands" — was wrong in its first link at the time it
  was written. The stale comment at the top of
  `retry-result-verification.test.ts` has been corrected in place.
- **`fa-training-mode-design.md` item 4, "A repaired run is never re-judged", is
  closed.** Its instruction that "the schedule must treat a retried run as
  unchecked, and a repair's own product goes unjudged" is now the opposite of the
  code: a repaired run is always checked, subject to the person's own switches
  and the authorization's bounds.
- **`fa-training-mode-design.md` blocking question 1, "Who authorizes an
  unattended check?", is answered and implemented end to end.** Its Phase 7 note
  that it is "Not verified that `loop_verification` works unattended at all" is
  now verified, by a real service test rather than by reading.
- **New Core code `core.check.after_repair`**, in
  `AUTOMATION_STUDIO_RESULT_CHECK_CODES`, recorded on the run and on the run
  summary. Anything downstream reading check codes (the Lab's lane observation
  reads `resultVerification`, not these) should know it exists.
- **The schedule interface gained one optional field.** `decide()` now accepts
  `repairedThisRun`; a replacement shape that ignores it silently loses the rule.

## Not verified

- **The conversation turn itself.** The gate that kept `sayResultCheck` silent on
  this path is open and asserted (`resultCheck` present, `outcome.performed`
  true), but no test stands up a conversation store and reads the posted turn
  back. `result-check-schedule/tests/conversation.test.ts` covers what the turn
  says; nothing covers that a *repaired* run posts one.
- **The SQLite column, end to end.** The service tests use the file store, so
  `readResultCheckState` answers from no rows and every run is ordinal 1. That
  `result_verification_status` is now written non-null for a repaired run is
  argued from `runResultVerificationStatus`'s single condition
  (`resultCheck.checked !== true → null`) and the summary metadata the test does
  assert, not observed in a database.
- **Whether a landed repair always bumps `flows.graph_revision`.** Inherited
  unverified from t104. It does not affect anything above — the repaired run is
  filed at its starting epoch either way — but it does decide whether the *next*
  runs are re-checked by a reset initial window.
- **The repair's own cost against the authorization.** `spentUsd` is
  `costUsdThisTrainingWindow`, summed from *previous* runs, so a repair made
  during this run does not count against this run's verification ceiling. That is
  pre-existing and deliberate (one tally, shared with the training budget), but it
  means a Flow repairing itself repeatedly draws down the ceiling one run late.
- **Live behaviour.** No provider call was made against DeepSeek; every model in
  these tests is a mock. What is proved is the chain, the records and the
  refusals, not a real verification's verdict quality.

## Open questions and contradictions found

1. **A repaired run is now checked on every repair, and that is a cost the person
   did not separately consent to.** It is small beside the repair that just
   happened (a verification measured at ~$0.0015 against a `runtime_patch` call),
   the ceiling binds it, and the off switch overrules it — but it is a new
   spending trigger and `settings.ts`'s "five checks in fifty runs" arithmetic no
   longer bounds a Flow that repairs itself often. Worth one sentence to the user.
2. **The repair itself still has no unattended authority.** Everything above
   assumes a model was available to *produce* the patch. In the shipped host
   (`_shared/runtime.ts`) `llmProviderResolver` returns `undefined` without an
   `executionGrant`, so an unattended run cannot repair itself at all; the tests
   here bind a resolver directly, as the existing adaptive-loop tests do. Gate 4
   is now closed, and the gate before it is not. That is
   `fa-training-mode-design.md`'s open question 2 ("Does a refutation's repair
   need its own authorization?") and it is the next thing standing between this
   project and a failing run that repairs itself unattended, end to end.
3. **`verify_result` sets `invokeLlm: false` by design**, so the one grant purpose
   named for verification explicitly forbids repairing. The standing
   authorization sits outside the purpose vocabulary entirely, which I think is
   right and is what `contracts.ts` already argues, but it means "a person
   pressed verify" and "the Flow is checked on a schedule" are two different
   mechanisms reaching one call site. They are told apart in exactly one place
   (`resolveAutomationStudioResultCheckProvider`, grant first), and that is worth
   keeping in one place.
