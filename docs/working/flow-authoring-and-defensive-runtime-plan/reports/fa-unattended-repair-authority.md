# t110 — a run that fails with nobody watching now repairs itself

All source changes are in **FluxIQ Core**, in the worktree `F:/fxwork/t110/!FluxIQ`
on `task/t110-unattended-repair-authority`. The web-extension worktree
`F:/fxwork/t110/!FluxIQWebExtension` has **no source change** — only this report.
No Lab run, campaign or provider call was started. Nothing was committed or
pushed.

## Outcome

Done. A run that fails with no person present now obtains a model, produces a
repair, applies it, retries, and has that retry judged — end to end, through the
real service path, with no `executionGrant` and no actor session anywhere in the
chain. The spending is bounded by the Flow's own standing authorization, refused
cleanly by its own code when that authorization is switched off, expired or
spent, and the run finishes either way rather than hanging or filing a
diagnosis for somebody to read in the morning.

## The gap was genuine, and I measured it before changing anything

The brief asked me to establish this rather than assume it, because t108 found
the equivalent "circularity" for verification had already been broken by a
standing-provider branch nobody had driven. There was no such surprise here.

I built the case first: the t108 harness, but with `llmProviderResolver` bound
exactly as `_shared/runtime.ts` binds it —
`(input) => input.executionGrant ? … : undefined` — and ran an unattended
failing run against unchanged code. Observed, in full:

```
PROBE status              failed
PROBE standingRequests    []
PROBE standingCalls       []
PROBE grantedCalls        []
PROBE llmGate             {"invoked":false,"providerConfigured":false,"ok":false,
                           "costAccounting":{"calls":0,…},"providerCalls":[],
                           "patchSkippedCode":"llm.runtime_patch_not_requested",
                           "diagnostics":[{"code":"llm.provider_missing",
                             "severity":"error",
                             "message":"No LLM provider is configured."}]}
PROBE adaptiveRetry       undefined
PROBE resultCheck         undefined
PROBE resultVerification  undefined
```

So: no model, no diagnosis, no patch, no retry — and, because a *failed* run has
no result to judge, no `resultCheck` and no `resultVerification` either. t108's
gate was closed and nothing ever reached it. Nothing was already working that
the brief did not already know about.

One thing the probe did establish that is worth recording: **the host wiring
needed no change at all.** `_shared/runtime.ts` already passes a
`resultCheckProviderResolver`, and nothing in it is verification-specific — it
reveals a key and builds a DeepSeek provider bounded by a ceiling. The same
resolver funds the repair. Only Core's *use* of it changed.

## The instrument: extended, not duplicated

The brief allowed either extending the standing authorization or explaining why
a separate instrument was needed. Extending it was right, and the reason is the
purse: two instruments over one Flow would keep two tallies of the same
spending and disagree about what the person's limit meant. So there is one
record, one key, one `maxTotalCostUsd`, one `expiresAtMs`, and now two clauses
the person switches on separately.

What I did **not** do is parameterise `redeem.ts`. Its comment makes a point of
the scope check taking no argument — "no settings field and no configuration by
which a standing authorization could come to pay for a diagnosis, an exploration
or a patch" — and making that sentence false would have been the single most
dangerous edit available. `repair.ts` is a separate, equally unparameterised
redemption: it *returns* its task kinds and takes none.

### The change, six source files

1. **`result-check-authorization/contracts.ts`** — the record gains
   `repair?: { enabled; maxCostUsdPerRun }`. Absent is what every stored
   authorization reads back as, so turning checking on never retroactively
   turned repairing on. `AUTOMATION_STUDIO_RESULT_CHECK_AUTHORIZATION_DEFAULTS`
   gains `repairMaxCostUsdPerRun: 0.25` — Core's own ceiling for a recovery
   nobody granted anything for (`run-budget.ts`), so the default authorizes the
   repair a granted run would have made and nothing wider. There is deliberately
   **no** default for `enabled`.
2. **`result-check-authorization/repair.ts`** (new) — the pure redemption.
   `AUTOMATION_STUDIO_UNATTENDED_REPAIR_TASK_KINDS` is exactly what
   `recovery/annotation/` runs (`runtime_diagnosis`, `evidence_tool_decision`,
   `runtime_patch`) and nothing else: not `loop_plan`, not `flow_bootstrap`, not
   `loop_verification`. Five refusal codes under a `core.repair.` prefix beside
   the check's `core.check.` ones, because one run can record one of each.
3. **`service/runtime-adaptation/repair-authority.ts`** (new) — redeems, calls
   the host with only the key and the ceiling, and returns an
   `AutomationStudioLlmProviderResolution`. Two things it does on purpose:
   it wraps the provider so a task kind outside the redemption **throws rather
   than spends**, and it sets **no `permittedConsequences`.**
4. **`recovery/annotation/ports.ts` + `annotate.ts`** — one new port, read
   **only where `resolveLlmProvider` produced nothing**. That ordering is what
   makes requirement 3 structural rather than incidental: a granted run resolves
   from the grant and the standing path is never entered.
5. **`service/flow-settings/result-check-settings.ts`** — parses the clause, off
   for anything it cannot settle. Only the ceiling defaults; the switch never
   does.
6. **`service.ts`** — one line binding the port. **The file is still 4583
   lines**, unchanged, and no method was added to the class (its ratchets are
   4584 lines and 222 methods).

`_shared/runtime.ts` and `docs/architecture/automation-studio.md` were corrected
where they now understated what that resolver funds; the doc's flat sentence
"A request that carries no execution grant resolves no provider" was false as
written and now says "from the grant service", followed by a new section
describing the instrument.

## What is now true, with the observed output

`tests/service-adaptation/tests/unattended-repair-authority.test.ts` (new,
11 tests, real service, real run, host-faithful resolver). Every harness in it
resolves **nothing** without a grant, exactly as the product does.

**1. End to end, unattended.**

```
✓ obtains a model, repairs itself, retries, and has that retry judged -- with no grant and no actor session
```

```
standingCalls     ["runtime_diagnosis","runtime_patch","loop_verification"]
standingRequests  [{keyId:"key.deepseek", maxEstimatedCostUsd:0.25, authorizedByUserId:"user.aiden"},
                   {keyId:"key.deepseek", maxEstimatedCostUsd:0.05, authorizedByUserId:"user.aiden"}]
grantedCalls      []
adaptiveRetry     {attempted:true, status:"succeeded", attemptCount:1}
resultCheck       {checked:true, code:"core.check.after_repair", status:"confirmed"}
resultVerification{status:"confirmed", performed:true, verdict:"answers", basis:"model"}
run.status        "succeeded"
```

Two redemptions at two ceilings — the repair's per-run purse and the check's
per-call one — drawn on one authorization, with no grant anywhere.

**2. Bounded and visible, and the bound actually binds.**

```
✓ records what the repair was authorized to spend, and what the one purse had left
```
`llmGate.repairAuthority` on the run detail reads
`{redeemed:true, keyId:"key.deepseek", authorizedByUserId:"user.aiden",
taskKinds:["runtime_diagnosis","evidence_tool_decision","runtime_patch"],
maxEstimatedCostUsdPerRun:0.25, remainingCostUsd:1}`.

That test also closes the link between "there is a ceiling" and "the ceiling is
reached", which is the part a design can get wrong invisibly. `spentUsd` is
`context.budgetState.costUsdThisTrainingWindow`, summed by `context.ts` from the
Flow's finished runs' `tokenUsage.estimatedCostUsd`. I probed what the repaired
run actually records there:

```
P2 tokenUsage {"inputTokens":22,"outputTokens":12,"totalTokens":34,"estimatedCostUsd":0.0045000000000000005}
```

0.001 (diagnosis) + 0.002 (patch) + 0.0015 (verification). The repair's own
spending reaches the tally the next redemption reads, so the purse genuinely
decrements. That is now asserted rather than assumed.

Each refusal, by its own code, each with the run still finishing:

```
✓ does not repair when the person authorized checking and not repairing, and says which refusal it was
✓ does not repair when the clause is switched off
✓ does not repair once the ceiling cannot cover a whole repair, and never asks the host for the key
✓ does not repair once the authorization has expired, which stops checking and repairing together
✓ does not repair when nobody authorized anything at all
```
`core.repair.authorization_disabled` (twice), `…_exhausted`, `…_expired`,
`…_absent`; `standingRequests == []` and `standingCalls == []` in every one, so
the key is never even asked for; `run.status == "failed"` in every one — the
failed run it already was, finished, not hung.

**3. A person's grant, both ways.**

```
✓ still judges a clean run's result itself, and the standing authorization is never reached
✓ still forces manual approval and still does not retry, and the repair authority is never consulted
```
With `verify_result`: `grantedCalls == [{taskKind:"loop_verification",
hasGrant:true}]`, `standingRequests == []`. With `diagnose_and_adapt`: still
`failed`, still `approvalMode == "manual"`, still no `adaptiveRetry`, every call
carrying a grant, `standingRequests == []`, and `llmGate.repairAuthority`
**undefined** — the new path was not entered at all.

**4. A consequential act still needs the person.**

```
✓ is granted no authority to act, so a lasting consequence is still the person's to allow
✓ meets a request rather than a silent refusal when it tries to spend money
```
End to end, a standing-funded repair's `llmGate.permissions` is
`{granted: [], instructed: [], lapsed: []}` — the repair is *told* it may not
act rather than discovering it. Then the real gate, built as `annotate.ts`
builds it for such a repair, is driven with a `move_money` declaration: the
verdict is `permitted: false`, `gate.request.missing == ["move_money"]`, the
request carries a sentence naming "Place order", and `gate.signal.aborted` is
`false` because there is a thread to answer in. Escalated, not failed.
`repair-authority.test.ts` holds the other half at the unit level: the
resolution has no `permittedConsequences` key at all, and the bound provider
rejects `loop_verification` and `flow_bootstrap` with
`A standing repair authorization does not pay for …`, the host's model never
being reached for either.

### Mutation-checked, three times

- Deleting the authority read from `annotate.ts` → **8 of 11 fail**, e.g.
  `expected [] to deeply equal [ 'runtime_diagnosis', …(2) ]`. The two
  person's-grant tests still pass, which is itself evidence for requirement 3.
- Deleting the binding line from `service.ts` → **8 of 11 fail**, same shape.
- Making the settings parser drop the clause → **7 fail** across two files,
  including `expected undefined to deeply equal { Object (enabled, maxCostUsdPerRun) }`.

All three were reverted and the suites re-run green. `service.ts` is back at
4583 lines.

## Commands run and observed results

- `pnpm --filter fluxiq exec vitest run …/unattended-repair-authority.test.ts`
  → **11 passed**, 16.6s.
- `pnpm --filter fluxiq exec vitest run …/result-check-authorization/tests/repair.test.ts
  …/runtime-adaptation/tests/repair-authority.test.ts` → **19 passed** (11 + 8).
- `pnpm --filter fluxiq exec vitest run …/flow-settings/tests/result-check-settings.test.ts`
  → **9 passed** (3 new).
- `pnpm --filter fluxiq exec vitest run` over `tests/service-adaptation`,
  `result-check-authorization`, `result-check-schedule`,
  `service/runtime-adaptation`, `service/flow-settings`, `recovery`
  → **536 passed, 53 files**. This includes t108's
  `unattended-retry-verification.test.ts` (8 passed) unchanged.
- `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime`
  → **2341 passed, 1 skipped, 5 failed across 4 files** under a 235-file
  parallel run. Every one passed alone:
  `run-detail-preservation.test.ts` 3 passed; `service-bootstrap/adaptation.test.ts`
  9 passed; `instruction-readiness.test.ts` 1 passed; `scale-pages.test.ts`
  3 passed (its parallel failure was a timing budget, `expected 505.75… to be
  less than 500`). Load, as the brief warned; none of the four configures a
  `resultCheckProviderResolver`, so none can reach the new path.
- `pnpm --filter fluxiq exec vitest run src/programs/_shared` → **118 passed**.
- `pnpm --filter fluxiq exec tsc --noEmit` → clean.
- `pnpm check` in `F:/fxwork/t110/!FluxIQ` → **exit 0**
  (`structure-audit: passed (181 warning(s), 360 baselined)`, all four packages
  `check: Done`).
- `pnpm check` in `F:/fxwork/t110/!FluxIQWebExtension` → **exit 0**
  (`structure-audit: passed (99 warning(s), 121 baselined)`, all ten packages
  `check: Done`).
- `pnpm --filter @fluxiq-web-extension/domain test` → **768 pass, 0 fail**.
- `pnpm --filter @fluxiq-web-extension/test-runner test` → **1335 pass, 0 fail**.

No Lab run, campaign or provider call was made; every model in these tests is a
mock.

## What Core's paired working document should record

- **`fa-unattended-repair-verification.md`'s open question 2 is closed.** "The
  repair itself still has no unattended authority… the next thing standing
  between this project and a failing run that repairs itself unattended, end to
  end" — that is now implemented and tested through the real service with the
  host's own resolver semantics.
- **`fa-training-mode-design.md`'s open question 2, "Does a refutation's repair
  need its own authorization?", is answered: no.** It needs a clause on the
  existing one, sharing its purse and expiry and carrying its own switch,
  ceiling and redemption scope.
- **New Core vocabulary:** `AUTOMATION_STUDIO_UNATTENDED_REPAIR_TASK_KINDS` and
  `AUTOMATION_STUDIO_UNATTENDED_REPAIR_CODES` (`core.repair.authorization_*`),
  plus `repairMaxCostUsdPerRun` on the authorization defaults, and
  `llmGate.repairAuthority` on the run detail. Anything reading run metadata or
  refusal codes should know the `core.repair.` prefix exists.
- **The authorization record gained an optional field.** A writer that
  round-trips it without `repair` silently switches unattended repair off. There
  is no product UI for the clause yet (see below).
- **`recovery/annotation/ports.ts` gained one optional port.** A host that binds
  `resolveLlmProvider` and not `resolveUnattendedRepairAuthority` keeps exactly
  today's behaviour, which is what every existing test does.
- **The directory name is now narrower than its contents.**
  `runtime/result-check-authorization/` holds the repair clause and its
  redemption too. I did not rename it: the rename touches the runtime barrel and
  five other files for no functional gain, and the brief did not ask for it. It
  is a real naming defect and belongs on someone's list.

## Not verified

- **Live behaviour.** No DeepSeek call was made. What is proved is the chain,
  the records, the ceilings and the refusals — not that a real model produces a
  good repair unattended. The ten-site campaign is where that gets answered.
- **The exploration stage under standing funding.** The recovery's exploration
  needs an `llmEvidenceRuntime` binding, which this harness does not stand up,
  so `evidence_tool_decision` is in the redemption's scope and in the provider
  guard but was never actually run through a standing-funded recovery. The
  diagnosis and the patch were.
- **A consequential act escalating end to end.** Requirement 4 is proved in two
  halves — the repair is granted nothing (asserted on a real run) and the real
  gate refuses-and-asks for a `move_money` declaration (asserted on the gate the
  recovery builds). No test drives a declared consequence through a live
  standing-funded repair into a conversation thread and reads the question back.
  That is the same gap t108 recorded about the conversation turn.
- **The clause has no UI and no API.** Nothing in `apps/web` or the API surface
  lets a person switch unattended repair on; today it is a field in the Flow's
  stored settings. Core owns the capability and the conversation is the
  product's general channel, so this probably wants to be askable there as well
  as settable in the Flow's settings — but as it stands the feature is
  reachable only by writing settings directly.
- **A second run drawing on a decremented purse.** I proved the repair's cost
  lands in `tokenUsage.estimatedCostUsd` and that `spentUsd` is summed from that
  field, and I proved the arithmetic at the unit level. I did not run a Flow
  twice and observe `remainingCostUsd` fall between runs, because the first
  run's patch persists and the second does not fail.

## Open questions and contradictions found

1. **A repair draws the purse down one run late, and much faster than a check
   does.** `spentUsd` is summed from *finished* runs, so a repair costing up to
   $0.25 does not count against its own run — pre-existing and shared with the
   checks, but far more material here: the $1 default covers about six hundred
   verifications and only four repairs. A Flow that fails repeatedly will exhaust
   the person's whole authorization on repairs and then stop being checked as
   well, because they share the purse. That is arguably right — one limit, one
   promise — but it is worth one sentence to the user, and it is an argument for
   the person being told when a Flow's authorization runs out rather than only
   having it recorded on the run.
2. **`repair.ts` and `redeem.ts` both end with a `Math.min` that cannot fire.**
   Each refuses when the remainder is smaller than the ceiling, then takes
   `Math.min(ceiling, remainder)` — always the ceiling. I kept it, to mirror
   `redeem.ts` exactly rather than have two near-identical functions diverge, and
   my test now asserts the real rule (a remainder that cannot cover a whole
   repair is *refused*, not trimmed). But dead code shaped like a protection is
   worth someone deciding about deliberately, in both files at once.
3. **`verify_result` sets `invokeLlm: false`, so the grant named for verification
   forbids repairing — while the standing authorization can now do both.** t108
   flagged the first half. The gap is now wider: a person pressing "check this"
   gets strictly less than a Flow left alone overnight. That is defensible (they
   are present, and can press "diagnose" too) but it is a real asymmetry between
   the two mechanisms that meet at one call site.
