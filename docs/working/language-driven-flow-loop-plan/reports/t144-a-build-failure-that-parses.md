# t144 — A build failure that parses

## Outcome

**Done.** The parser hole is closed at its root: the producer and the reader of a
failure diagnostic now read one table instead of carrying a copy each, so a code
Core can write is a code Core can read, and a new code cannot break that without
failing the type check. The six run-budget refusals have their own pre-provider
codes and no longer claim a provider was reached. `generation-failure.ts` is gone
— the directory is nine modules, the largest 221 lines — and the structure audit
**passes** with no finding on any file I own. The `amendmentsRefused` field t140
added to the loop's trace now reaches a stored record.

Three things I could not do, all stated below: the `service.ts` edit that makes
the never-null entry point actually take effect (another worker is in that file),
the removal of `service.ts`'s duplicate throw classifier, and
`pnpm structure:baseline`, which the brief forbids and which now has one stale
entry to clear.

---

## 1. Reproducing it, and what it proves

```
npx vitest run .../service-bootstrap/tests/accounting.test.ts \
  -t "attributes an unexpected harness throw conservatively"
→ 1 failed: AssertionError: expected null not to be null
     at rejectedGenerationDiagnostic (fixtures.ts:139:28)
```

Confirmed, and the cause traced end to end rather than assumed:

1. The test makes `runFlowBootstrapLlmHarness` reject with a plain `Error`.
2. `service.ts:1503-1567` has `failureStage = "provider_request"` by then, so the
   catch at 1736 calls `unclassifiedThrowCode`, which returns
   `flow_bootstrap.unexpected_error` — one of the three codes `a8cc85e` added.
3. `flowBootstrapPhaseFailure` wrote that stage's state **from the stage alone**:
   `retryable: false`, `providerResponse: "unknown"`, no accounting.
4. The parser held **its own** per-code table (`fixedProviderFailureState`). It
   had no entry for `unexpected_error`, so it fell through to
   `return value.retryable === false && value.providerResponse === "received"` —
   and the record says `"unknown"`. Parse → `null`.

**What it proves.** Not "the parser forgot three codes" but something worse: the
state a code implies was written out **three times** — once in
`flowBootstrapPhaseFailure`, once per arm in `providerHarnessFailureProjection`,
and once in `fixedProviderFailureState` for the reader. Nothing tied them
together, so `a8cc85e` could add codes to the taxonomy, teach one copy, pass its
own tests and leave the reader unable to read what the writer had just written.
Every diagnostic of all three kinds then came back `null`, and `null` at
`service.ts:2668` is published as the bare word `flow_bootstrap.extend_failed` —
a code that belongs to no stage and that nothing can read back. That is the whole
account `run-muhubegx-9469de5e` left of its wrong-answer repair.

The test had been failing on `dev` since `a8cc85e`, which is how the defect
surfaced at all.

## 2. The fix: one table, read from both sides

`generation-failure/failure-state.ts` now owns the answer to "what must a
diagnostic with this code, at this stage, say about itself" — retryability,
whether the provider was reached, what came back, and whether accounting and the
permission request are required, absent or optional.

- **The writers read it.** `flowBootstrapPhaseFailure` and
  `flowBootstrapHarnessFailure` no longer decide any of those fields. The harness
  arms now choose only a code and a stage; the state comes from the table.
- **The reader reads it.** The parser computes the expected state with the same
  function and compares. It no longer holds a table of its own.
- **The type check enforces it.** The provider-request rules are keyed by
  `Exclude<ProviderRequestCode, ProviderPreflightCode>`, derived from the stage's
  own code list, so a code added to the taxonomy without a rule **fails
  compilation**. That is the check that was missing when `a8cc85e` added three.

Consequence: "every diagnostic Core produces parses back" is now a property of
one table rather than of three lists happening to agree. `run-muhubegx`'s
re-author would today record `flow_bootstrap.unexpected_error`, stage
`provider_request`, not retryable, provider reached, answer unknown.

The loosening did not make the parser a rubber stamp — six adversarial cases are
pinned, including a refused reservation claiming the provider answered and a rate
limit that says nothing came back.

### A second hole the new guard found

The round-trip guard immediately failed on `flow_bootstrap.permission_required`:
`flowBootstrapPhaseFailure` would accept that code and produce a diagnostic with
no permission request, which the parser (correctly) refuses. So a second code
could be *written* and not *read*. "Carries the question a person answers" is now
a field of the same state table, the parser reads it there instead of
special-casing the code inline, and a phase failure asked for that code gives way
to its stage's default. Same rule already applied to a code that must carry
accounting the caller did not supply.

### The never-null entry point

`automationStudioFlowBootstrapFailureDiagnosticOf(error, stage)` returns a
diagnostic for **any** thrown value: the one it carries, or a named unknown with
its stage and its provider-invocation state. That is the brief's requirement that
a throw whose kind cannot be established still parses into something a caller can
act on. It is pinned for an `Error`, a `TypeError`, a bare string, `undefined`, and
a hostile object whose `diagnostic` getter throws.

**It is exported and not yet called.** Making it take effect is the `service.ts`
edit in section 6.

## 3. The six budget refusals (coordinator's addition, from t145)

`llm_budget.run_call_limit`, `run_total_limit`, `run_output_limit`,
`run_cost_limit`, `duplicate_request` and `invalid_reservation` had no arm, so
they fell to the `default` arm and came out as
`flow_bootstrap.provider_transport_unknown` at stage `provider_request` with
`providerInvocation: "attempted"` — a request attempted whose answer is unknown,
true of nothing that happened. `run-muhs8hx3-6fd929e6` and
`run-muhtuizo-c458e49c` recorded exactly that.

They now have six pre-provider codes of their own, named
`flow_bootstrap.run_budget_*`, keyed by `AutomationStudioLlmRunBudgetDiagnostic["code"]`
so a seventh budget refusal fails the type check until it is named here. Each
projects to:

```
stage: "pre_provider_validation"    providerInvocation: "not_attempted"
retryable: false                   providerResponse:   "not_received"
accounting: { requestId, estimatedInputTokens, provider, model }   // no status, no usage
```

Two details worth stating. **The projection had to gain a stage it did not
have**: the provider branch hardcoded `providerInvocation: "attempted"`, so I
widened its result to carry a stage and take the invocation state from the table
— that hardcoded `"attempted"` *was* the lie. And **the accounting travels**,
because the request that was never sent is the only thing the refusal is about,
and these six join `FLOW_BOOTSTRAP_HARNESS_PREFLIGHT_CODES`, the pre-provider
codes the parser admits accounting for. It carries no status and no usage,
because there was no call to have either.

This is the projection half only. t145 names the `harness/run.ts` half — a
refused reservation returning provider metadata although nothing was sent — which
is what routes these into the provider branch at all. I did not touch `harness/`.

## 4. The self-contradicting comment: I corrected the comment

The comment said `flow_bootstrap.provider_configuration_invalid` **and**
`provider_transport_unknown` were "no longer produced". True of the first, never
true of the second: lines 643 and 647 produced it and two live runs recorded it
four commits later.

**I made the comment true rather than the code match it**, and here is why. The
code has two producers. One is the harness's own `llm.provider_request_failed` —
a request that failed and says nothing else — for which "a request whose answer is
unknown" is exactly right. The other is the `default` arm, and for a failure whose
kind the harness never named, that sentence is the one honest thing left to say;
removing the code would mean inventing a *less* informative answer for it. What
the two runs actually hit was the second producer, and the substantive fix is
section 3: the largest known class reaching that arm now has its own codes. The
comment now names both producers, says a code arriving at the `default` arm is a
gap to be named rather than a shape to live with, and the two codes are no longer
grouped under one claim.

## 5. The `amendmentsRefused` carry-through (separate change)

`evidence-loop-steps.ts` copied a fixed field list off the trace row, so t140's
`amendmentsRefused` never reached a stored record — and `run-muhubegx-9469de5e`
made nine amend decisions, seven of which applied nothing, with one word
(`llm_evidence_loop.draft_unchanged`) published for all seven.

The field now travels, held to the same rule as everything else on a step: a step
number and a code, never prose.

- **Reasons are a closed set, keyed by `AutomationStudioFlowDraftAmendmentRefusal["reason"]`**,
  so a reason added in `flow-draft/amendment.ts` fails this file's type check
  until it is named here.
- **The step number is bounded** (9,999). It is the model's own number — a
  refusal reading `no_such_step` is precisely the case where it named one that is
  not there — so it is bounded rather than trusted.
- **At most sixteen**, the most amendments one decision may carry.
- Added to `EVIDENCE_STEP_FIELDS`, which is the allow-list whose omission would
  otherwise take the whole diagnostic down rather than arriving short.

No barrel change was needed. 11 tests in a new
`flow-bootstrap/tests/evidence-loop-steps.test.ts` — that file had no tests of
its own before; it was covered incidentally by the generation-failure tests.

## 6. Changes needed outside my files, described and not made

1. **`runtime/service.ts:2668`** — replace the `extend_failed` invention:

   ```ts
   failureCode: (error) => {
     const diagnostic = automationStudioFlowBootstrapFailureDiagnosticOf(error, "pre_provider_validation");
     return {
       code: diagnostic.code, stage: diagnostic.stage, retryable: diagnostic.retryable,
       providerInvocation: diagnostic.providerInvocation, providerResponse: diagnostic.providerResponse,
       ...(diagnostic.accounting?.providerStatus === undefined ? {} : { providerStatus: diagnostic.accounting.providerStatus })
     };
   }
   ```

   The `if (!diagnostic) return { code: "flow_bootstrap.extend_failed" }` branch
   goes away. `pre_provider_validation` is the honest stage for that call site: a
   throw out of `generate` that carries no diagnostic came from
   `getLlmExecutionBinding` or from approve/apply, not from a provider call.
   Without this edit the parser fix alone already ends the observed failure — the
   diagnostic now parses, so the fallback is not reached — but the fallback
   remains for a throw from outside the build.

2. **`runtime/service.ts:352-361`** — delete the private
   `unclassifiedThrowCode` and call the exported
   `flowBootstrapUnclassifiedThrowCode` instead. **Two copies of a classification
   is the exact shape that caused this defect**; I could not remove the duplicate
   without editing that file. There is a comment on the export saying so.

3. **`pnpm structure:baseline`** — the deleted `generation-failure.ts` leaves one
   stale `failure-as-empty` entry ("1 baseline entries can be lowered"). The
   finding itself is **gone**, not moved: `error.ts` returns a named
   `"unreadable"` from that catch instead of `null`, which says what happened and
   is not an empty value. I was told never to run the baseline command.

## 7. Structure

`generation-failure.ts` (817 lines, over the 800 limit, red on `dev`) →
`generation-failure/`:

| module | lines | owns |
| --- | --- | --- |
| `codes.ts` | 221 | every reason a build can end, grouped by stage; code → stage |
| `harness-failure.ts` | 184 | a harness refusal's code and stage |
| `failure-state.ts` | 169 | **the one table**: what a code's own fields must say |
| `evidence-failure.ts` | 151 | the exploration's endings, including the person's question |
| `diagnostic-parse.ts` | 141 | a published diagnostic read back |
| `phase-failure.ts` | 107 | a phase's own catch; the never-null diagnostic of a throw |
| `harness-vocabulary.ts` | 76 | the provider pre-flight and run-budget vocabularies |
| `diagnostic.ts` | 70 | the diagnostic's shape and its issue codes |
| `error.ts` | 57 | the error class, and reading it off a caught value |
| `index.ts` | 19 | barrel |

No cycles: `harness-vocabulary → codes → diagnostic → failure-state →
diagnostic-parse → error → phase-failure`, with the two constructors on the end.
Tests moved into `generation-failure/tests/` (the directory owning their
subjects): `diagnostics.test.ts` (the 50 existing tests, unchanged) and
`round-trip.test.ts` (new, 224).

Importers repointed: `flow-bootstrap/index.ts`, `flow-bootstrap/action-permissions.ts`.
`llm/harness-options/bootstrap-completion.ts` already imported through the
`flow-bootstrap` barrel and needed nothing.

## 8. Commands run and observed results

From `packages/fluxiq`:

```
npx tsc --noEmit
→ clean (no output)
```

```
npx vitest run .../runtime/flow-bootstrap .../runtime/tests/service-bootstrap
→ Test Files 37 passed (37)   Tests 608 passed (608)
```

The brief's path `.../runtime/service-bootstrap` does not exist; the suite is at
`.../runtime/tests/service-bootstrap/tests/`. Within that 608:

- `accounting.test.ts` 10 passed, including the three kinds of unrecognised
  throw (was 8 tests, 1 failing).
- `generation-failure/tests/round-trip.test.ts` 224 passed.
- `generation-failure/tests/diagnostics.test.ts` 50 passed, unchanged.
- `flow-bootstrap/tests/evidence-loop-steps.test.ts` 11 passed, new.

Wider, to check nothing downstream moved:

```
npx vitest run .../runtime/recovery .../runtime/service .../api
→ Test Files 73 passed (73)   Tests 730 passed | 1 skipped (731)
```

```
npx vitest run src/programs/automation-studio
→ Test Files 5 failed | 338 passed (343)   Tests 5 failed | 3360 passed | 1 skipped
```

**All five attributed, none mine:**

- Four (`service-bootstrap/adaptation`, `service-flows/canonical-persistence`,
  `service-flows/scale-pages`, `service-recordings/proposals`) died on the
  15,000 ms per-test timeout under full-suite parallelism. Re-run as their own
  four files: **31 passed, 4 files green.** Contention, not regression — the
  pattern `AGENTS.md` warns about for concurrent heavy runs.
- `flow-draft/tests/entry.test.ts` — "drops arguments before it drops steps" —
  `TypeError: Cannot read properties of undefined (reading 'steps')`:
  `automationStudioFlowDraftEntry({ steps, maxBytes: 900 })` returns `undefined`.
  Neither `flow-draft/entry.ts` nor its whole import closure
  (`core/index.ts`, `./step.ts`, `./routing.ts`) nor the test is modified in the
  working tree, so this is a real failure in committed code on `dev`, predating
  my change. Introduced somewhere at or before `b2fab59`. **Worth someone's
  attention** — it is a live bug in the draft the model is shown.

From `F:\!FluxIQ`:

```
node scripts/structure-audit.mjs
→ structure-audit: passed (182 warning(s), 358 baselined).   exit 0
```

Both files the brief expected to be red (`llm/evidence-loop.ts`,
`llm/deepseek/provider.ts`) have been cleared by other workers; **the audit now
passes outright**, and I left them alone. No finding on any file I own. One
advisory warning touches my work: `generation-failure/tests/diagnostics.test.ts`,
514 lines, past the 400-line advisory — the same 514-line file, same content, at
its new path, so unchanged from `dev`. Splitting it by subject is a clean
follow-up I did not take for an advisory that predates the task.

Also observed, transiently, and **not mine**:

- One tsc error in `recovery/context.ts`
  (`Cannot find name 'automationStudioScreenedAuthoredState'`) and 20 failures in
  `recovery/tests/context.test.ts`, mid-edit by the worker in
  `runtime/recovery/repair-context/`. Both gone on re-run; that suite is green.
- One tsc error and one audit `imports` violation from
  `flow-bootstrap/tests/t152-scratch-projection.test.ts`, a file another worker
  created against the path I deleted. Its first line says "Deleted before the
  task is reported." They repointed it themselves; I did not touch it. **If it
  is still there at integration it must be deleted** — it logs to the console and
  reaches past two barrels.

## 9. Not verified

- **No live run.** The claim that `run-muhubegx-9469de5e`'s repair would now
  record a named code rests on reproducing its failure path in the service test,
  not on re-running it against DeepSeek.
- **Which of the six budget refusals the two `transport_unknown` runs actually
  were.** t145 says the bundle keeps only the projected code, so it cannot be
  recovered. I closed all six; I did not confirm the diagnosis.
- **The `service.ts` half of the never-null path.** Exported, tested at the
  module level, called by nothing yet. Until section 6 item 1 lands, a throw from
  outside the build still becomes `flow_bootstrap.extend_failed`.
- **`harness/run.ts`.** Not read past what t145's report says about it, not
  edited.
- **Anything outside `packages/fluxiq`.** No Core build (the brief forbade it),
  no `pnpm check`, no `pnpm build`, no web app tests.
- **`pnpm quality:check` (biome) does not cover these paths** — it reported all
  four as ignored by `biome.json`, so no lint signal either way.

## 10. Open questions and contradictions found

1. **`flow-draft/entry.test.ts` fails on `dev`.** See section 8. Not mine, not
   caused by me, and a real defect rather than flakiness.
2. **`flow_bootstrap.extend_failed` belongs to no stage.** It is not in the
   taxonomy, so a consumer that receives it cannot recover a stage, a
   retryability or a provider state from it — and `refuted-result/reauthor.ts`'s
   tests pin it as an expected value. Once section 6 item 1 lands, those
   expectations should change to a real code; I left them alone because the
   producing line is in `service.ts`.
3. **`providerInvocation` at the `default` arm is still a claim, not an
   observation.** For an unrecognised harness code with provider metadata
   present, Core cannot say whether a request went out, and the arm says
   `"attempted"`. The budget codes were the known instance and are fixed; the arm
   remains the one place the field is derived rather than observed. Naming the
   next code that lands there is the only real remedy.
4. **The stale baseline entry.** Someone with permission to run
   `pnpm structure:baseline` should, to clear the one lowered entry.
