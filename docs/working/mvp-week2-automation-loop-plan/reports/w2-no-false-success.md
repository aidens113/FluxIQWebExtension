# w2-no-false-success — a run that was never judged must not read as passed

Task `t012`, branch `task/t012-result-required-fields`, worktrees
`F:\fxwork\t012\!FluxIQ` (Core) and `F:\fxwork\t012\!FluxIQWebExtension`
(downstream). Nothing committed. Nothing in the main checkouts changed except
this file.

## Headline

The false success is gone, proven live against real DeepSeek on the same
scenario, twice, with the same extraction measurement either side of the fix:

| | baseline (run-mu7c7df9-d352008b) | after (run-mu7co5cz-84222d5b) |
| --- | --- | --- |
| `oracleVerdict` | `failed` | `failed` |
| `reportedVerdict` | **`passed`** | **`failed`** |
| extraction | 10 records, **0 matched**, 41 of 50 fields | 10 records, **0 matched**, 41 of 50 fields |
| every action | `succeeded`, `comparisonStatus: matched` | `succeeded`, `comparisonStatus: matched` |
| `resultVerification` | (not recorded) | **`refuted`** |
| `harnessActivations` | 0 | 1 |

The run's steps are identical and all succeeded. What changed is that the
finished run's result was put to a model at all.

**The load-bearing fix was fix 2, not fix 1.** I measured that live rather than
assuming it, and it contradicts the brief's framing of the defect.

## What I inherited, and whether I kept it

A previous worker left substantial uncommitted work in the Core worktree. I read
it all before touching anything. It is the right shape and I kept every line of
it; I added to it rather than redoing it.

Inherited and kept:

- `AS/runtime/result-verification/result-summary.ts` — counts, per record set,
  the stored rows lacking a value for a field the set's own schema declares
  required, bounded by a new `maxRowsCheckedPerSet: 200`, emitting two counts
  and the field **ids** (never values).
- `AS/runtime/result-verification/core-observation.ts` — turns that count into a
  free `does_not_answer` verdict, code `core.result.required_values_missing`.
- `AS/runtime/result-verification/verification-status.ts` (new) — the four-word
  status `confirmed | refuted | unverified | no_result`.
- `AS/runtime/result-verification/run-outcome.ts` — reads one page of rows for
  the check while still sampling only four for the model, and writes `status`
  onto both the runtime session and the run detail.
- `AS/runtime/llm/{grant-capabilities,runtime-session-grant,execution-grants}.ts`
  and `AS/api/contracts/llm.ts` — the `verify_result` grant purpose: one call,
  `loop_verification` only, and `invokeLlm: false` so the run stays
  deterministic.
- Its five test files.

It compiles (`pnpm --filter fluxiq build` exit 0) and its 48 result-verification
tests and 347 LLM tests pass. What it did **not** have was any caller: nothing
in either repository ever asked for a `verify_result` grant, so the second half
of the defect was untouched. That is what I built.

## Where "required" is declared, and whether Core may read it

`required` is declared by the Flow itself, in two layers:

1. **Core's contract.** `packages/contracts/src/record-sets/schema.ts`:
   `AutomationStudioRecordField.required?: boolean`, documented "A row missing a
   required field is invalid." Core reads it back on every dataset page
   (`AutomationStudioRunDatasetPage.schema`), so the run's verification has it
   without asking anyone.

2. **Who sets it, downstream.** `domain/src/output-nodes/extract-list/record-output.ts`
   builds the dataset schema from the extraction's own field map with
   `required: spec?.required !== false` — a field is required **unless the model
   writing the Flow explicitly declares `required: false`**. The grammar the
   model is shown (`extract-list/catalog-text.ts`) exposes exactly that.

So Core may read it, and it is the Flow's own declaration, never the Lab's
answer key. Core's check consults nothing else.

**Why validation does not already catch it.**
`packages/contracts/src/record-sets/validate-records.ts` refuses a row whose
required field is `undefined` or `null` (`records.required_missing`). It does
not refuse an **empty string**: `copyCell` accepts any string for a `string`
field. And an empty string is exactly what the browser hands back — the content
script's `field-reader.ts` returns `undefined` only when the *element* is
missing; an element that exists and holds no text yields `""`, which
`extract-list.ts` does not count in `missingFields` either. So the row is
stored, the step passes, and the run passes.

## The free check

Deterministic, settled before a provider is resolved, and free:

- Per record set, read up to `maxRowsCheckedPerSet` (200) stored rows — a local
  read of one page, already fetched; nothing extra is sent.
- A row "lacks" a required value when the key is absent, `null`, or a string
  that is empty once trimmed. A number, boolean or structure is a value whatever
  it holds; nothing here judges whether a value is *plausible*.
- Only `required: true`, `handling: include` fields count. A set whose schema
  could not be read reports `rowsChecked: 0` rather than passing rows it never
  compared.
- One such row settles the run: `does_not_answer`, basis `core_observation`,
  code `core.result.required_values_missing`, failure category
  `output_not_observed`. The observation names counts and field **ids** only.

It is domain-neutral — records, fields and `required` are Core vocabulary — and
it costs nothing.

### It did not fire on the live defect, and that is correct

`property-listings-newest-homes` stores 10 rows with `invalidCount: 0` and
`totalRowsMissingRequired: 0`. The 9 absent values of the 50 the answer key
wants belong to fields the **built Flow declared optional**, and every field the
Flow declared required carried a non-empty value. `matchedRecords: 0` means the
values that were present were wrong.

So this is the same shape as the `company-directory-logistics-sector` run the
supervisor measured (`run-mu7c2psy-7bd51633`: 40/40 records, 120/120 fields
present, 0 invalid rows, 35 matched): **all required fields present and
well-formed, values wrong.** No free check can catch it without an answer key,
and Core must not have one. Fix 1 remains worth having for the shape the brief
cites (`kelford-homes`, 267 of 285 fields) and as a fail-closed backstop that
costs nothing, but it is **not sufficient**, and I have measured that rather
than argued it.

**A real limitation worth recording:** because a built Flow's field is required
only until the model writes `required: false`, the model can disarm Core's free
check by declaring a column optional. That is an authoring-contract weakness in
`domain/src/output-nodes/extract-list`, not a Core one — Core may only hold a
Flow to what the Flow declares. I did not change it; it is outside this brief.

## How a created Flow's run now obtains a verdict

`AS/runtime/result-verification/verify.ts` settles the free observations first,
then `if (!request.provider) return { performed: false, ... }`. The provider is
resolved (`service.ts`, `runRuntimeSession`) only when the run carries an
execution grant whose purpose admits `loop_verification`. The Lab's created-Flow
lane ran the built Flow **with no grant at all** — `lane.ts` said so in as many
words, "runs the created Flow without a provider" — so the question was never
put and the run kept its `succeeded`.

Both halves were needed:

**Core (inherited).** `verify_result` is a grant purpose a runtime session
accepts, authorizing exactly one `loop_verification` call and nothing a recovery
could spend a grant on. `automationStudioRuntimeAdaptationContextForGrant` turns
`invokeLlm`, `createAdaptations` and `promoteAdaptations` off for it, so the run
executes exactly as deterministically as one with no grant.

**Lab (mine).** The created-Flow lane now takes out a `verify_result` grant
immediately before the playback and passes it as `llmExecution`:

- `live-llm/live-llm-plan.ts` — `verify_result` in the purpose table,
  non-iterating. It is never a *plan's* purpose; `purposeOf` never returns it.
- `live-llm/execution-grant.ts` — an `override: { purpose, maxCalls }`, and the
  run token budget narrowed to `min(plan.maxTotalTokensPerRun,
  perCallTokens × maxCalls)`. **This was a live failure I had to fix**: Core
  refuses a grant whose run budget exceeds what its own calls could spend, so a
  one-call grant beside a 600,000-token plan was rejected with "LLM total token
  limit is invalid" (run-mu7chivm-77733e0e). The high-token confirmation is now
  sent only when the grant asks for the plan's whole budget.
- `live-llm/live-llm-run.ts` — `verificationAuthorizer`, which does **not**
  overwrite `this.grant`, so the build's own grant stays what the snapshot
  reports.
- `flow-lane/creation/lane.ts` — `authorizeVerification`, called last before the
  run because Core expires a grant within the minute.
- `flow-lane/persisted-flow-run.ts` — the purpose union, plus reading Core's
  `metadata.resultVerification.status` back off the run detail.
- `run-scenario.ts` — the wiring.

Three things a grant-carrying run gives up, each checked and each harmless here:
the pre-started run id and idempotency key exist for a two-step start this path
does not take; `authorizedDomainIds` is zeroed, and it gates only cross-scope
composite Flow calls (`model/composites.ts`), not browser actions;
`authorizedExternalSideEffects: false` gates only whether a *live patch* may be
side-effecting (`runtime/live-patch.ts`), not the Flow's own actions.

## What a skipped verification means, and why

`unverified`. Not `passed`, not `failed`.

Core keeps the run's own status as its steps earned it, and records
`resultVerification.status` beside it:

- `confirmed` — judged, and it answers the request.
- `refuted` — judged, and it does not, or nobody could tell. **`unknown` fails
  closed here**: `automationStudioResultVerdict` maps `unsure` to a non-answer,
  and Core fails the session.
- `unverified` — there was a result and nobody judged it, because the run
  reached no model.
- `no_result` — the run stored no record set, so there was nothing to judge.

Any skip reason the module does not recognise is `unverified`: a new way of not
judging a result is still not a judgement.

**Why not fail an unverified run.** A deterministic replay of a saved Flow on a
schedule, with no model configured, is how most automations run. Failing every
one of them for the absence of a judgement would break working automations to
make a point. **Why not pass it.** That is precisely the defect: a result nobody
checked read as a result that was right.

**Made visible in `reportedVerdict`.** `RunEvaluation["reportedVerdict"]` is now
`"passed" | "failed" | "unverified" | null`, and the Flow lane emits it:

- steps not all clean → `failed` (unchanged);
- `refuted` → `failed` (belt and braces; Core already failed the session);
- `unverified` → `unverified`;
- `confirmed`, `no_result`, or nothing recorded → `passed`.

`no_result` stays `passed` because a Flow that stores no records has no result
of this kind and its steps are the whole account. A run carrying no verification
record at all stays `passed` too: nothing claims a judgement was skipped, which
is a different fact from Core saying so, and reading it as unverified would
relabel every run against a Core that records none.

The bench needs no change and I made none: `unverified` is neither a false
success (`oracleVerdict: failed` + `reportedVerdict: passed`) nor a false
failure. It sits in both denominators and is a hit in neither — which is exactly
what "nobody knows" should do to a measured accuracy rate.

I read every comparison against `reportedVerdict` in the repository. None
breaks. Two become slightly conservative when an `unverified` run appears:
`aggregate-report.ts`'s `executed` and `extraction-metrics.ts`'s
unmatched-extraction count both test `=== "passed"`, so an `unverified` run is
counted in neither. That is the right direction — a run nobody judged should
not add to a success rate — and `aggregate-report.ts` already documents why
that test is `=== "passed"` rather than `!== "failed"`. Worth knowing when
reading a corpus that contains any.

`oracleVerdict` deliberately did **not** widen. The fixture oracle always
reaches a verdict or is not consulted, so `evaluation-validation.ts` now checks
the two verdicts against separate vocabularies.

### What the company-directory shape would now report

`company-directory-logistics-sector` — all 120 fields present and well-formed,
0 invalid rows, 35 of 40 records matched, no provider at playback — would now
report:

- **With the verification grant wired (the campaign's path): whatever the model
  says, and `failed` if it says no or cannot tell.** That is the only lever
  there is. The model is shown the instruction, the Flow's shape, and a bounded
  summary with at most 4 sample rows per set out of 40. Five wrong values in
  forty records may well not appear in four samples, so I will not claim this
  run flips. `property-listings-newest-homes` flipped because every one of its
  ten records was wrong; a 5-in-40 error rate is a genuinely harder judgement
  and may still come back `confirmed`.
- **With no grant (a replay, or any run that reaches no model): `unverified`.**
  Never `passed`. That is the honest floor, and it is the part that does not
  depend on the model noticing anything.

I am stating that plainly rather than claiming a fix I have not measured.

### The unjudged pagination expectation

The supervisor asked, without widening scope: can Core notice a declared
expectation going unjudged without an answer key? For that specific case, yes,
and it does not need one. The **Flow** declares whether its extraction paginates
(`WebAutomationExtractListRequest.paginate`), and the extension reports
`pagesRead` in its own extraction summary (`content/actions/extract-list.ts`).
A Flow that declared pagination and read one page did not do what it declared,
which is the same class of statement as a missing required value: Flow-declared,
deterministic, no answer key. I did not build it — out of scope — but it is a
real, free check that would sit beside the one added here.

## Validation

All commands run from inside `packages/fluxiq` (Core) or the downstream
worktree root, never a repository root.

**Live, real DeepSeek, isolated target, instance `t012`.** Baseline first, per
the supervisor's live-first ordering.

```
FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated FLUXIQ_LAB_INSTANCE=t012 \
  pnpm lab:campaign property-listings-newest-homes
```

1. `run-mu7c7df9-d352008b` — baseline, inherited Core work built in, no Lab
   change. `oracleVerdict: failed`, `reportedVerdict: **passed**`,
   `automationFailureReported: null`, 3 provider calls. The defect reproduced,
   and the free required-field check correctly did not fire.
2. `run-mu7chivm-77733e0e` — first attempt at the grant. Failed at
   `preflight-llm-execution (400): LLM total token limit is invalid.` — Core
   refusing a one-call grant that asked for the plan's multi-call run budget.
   Fixed by narrowing the budget.
3. `run-mu7co5cz-84222d5b` — **`reportedVerdict: failed`**, `status: failed`,
   `resultVerification: "refuted"`, `harnessActivations: 1`, all actions
   `succeeded` / `comparisonStatus: matched`, `failure: null`, same extraction
   measurement as the baseline (10 records, 0 matched, 41/50 fields),
   5 provider calls, $0.0174.

**Both tasks, after a clean Core rebuild** (campaign `2026-09-18T19-32-36-458Z`,
`pnpm lab:campaign property-listings-newest-homes order-operations-batch-export`):

```
totals: tasks 2, passed 0, succeeded 0, failed 2, noResult 0,
        providerCalls 8, reportedCostUsd 0.0273812
```

- `property-listings-newest-homes` → `run-mu7cwna6-5f7e9bdd`: `oracleVerdict
  failed`, **`reportedVerdict failed`**, `resultVerification: "refuted"`, same
  extraction as before (10 records, 0 matched, 41/50 fields, `invalidRows: 0`).
  The fix reproduced on a second independent run.
- `order-operations-batch-export` → `run-mu7czffv-268a0b3a`: `oracleVerdict
  failed`, **`reportedVerdict failed`**, `resultVerification: "refuted"`, all
  four actions `succeeded`, `failure: null`.

**Read `order-operations-batch-export` carefully — it is not evidence for this
work.** That run stored **0** records, not the 7 the brief's earlier campaign
saw, so it was settled by Core's **pre-existing** free `core.result.no_records`
observation. `harnessActivations: 0` proves no provider call was spent, which is
correct: the free observations settle before a provider is even resolved. The
model built a different Flow this time, and the failure shape changed with it.
The task now reports failure, as the brief required — but the run that
demonstrates the new work is `property-listings-newest-homes`, twice.

A useful thing it does show: the free path and the model path both work, and the
free one still costs nothing.

**One earlier campaign was refused, correctly.** Campaign
`2026-09-18T19-30-00-018Z` returned `noResult` on both tasks with 0 provider
calls: reverting my mutations touched `verification-status.ts`, and the Lab
refused to run against a Core `dist` older than its source. That guard also
retroactively confirms the three earlier runs each used a correctly built Core.
Rebuilt (`pnpm --filter fluxiq build`, exit 0) and re-ran.

**Core unit suites** (`npx vitest run …` from `packages/fluxiq`):

- `src/programs/automation-studio/runtime/result-verification` — **5 files,
  48 tests, all passed.**
- `src/programs/automation-studio/runtime/llm` — **30 files, 347 tests, all
  passed**, including the inherited `tests/verify-result-grant.test.ts` (4).

**Mutations, each run and each reverted.**

1. *Let a record missing a required value pass the free check.* In
   `core-observation.ts`, replaced the `totalRowsMissingRequired` branch with
   `return undefined`. → **3 tests failed across 2 files**, including
   `run-outcome.test.ts > fails a run whose stored rows leave a required field
   empty`: `expected 'succeeded' to be 'failed'`. Reverted; 48/48 pass again.
2. *Let a skipped verification read as passed.* In `verification-status.ts`,
   returned `"confirmed"` instead of `"unverified"` for a skip. → **4 tests
   failed across 2 files**, including `verification-status.test.ts`:
   `expected 'confirmed' to be 'unverified'`. Reverted.

**Downstream unit suites.**

- `pnpm --filter @fluxiq-web-extension/test-contracts test` — **114 pass,
  0 fail**, including the new `unverified` contract case.
- `pnpm --filter @fluxiq-web-extension/test-runner test` — **1142 pass, 0 fail**
  on a clean rerun. Its first invocation reported `pass 1141 / fail 1` without
  naming the test; two subsequent full runs were clean, so I am recording it as
  non-reproducible rather than chasing it.

**Full Core `src/programs/automation-studio` suite — read this carefully.**
`npx vitest run src/programs/automation-studio` reported **2229 passed,
15 failed** (251 files). That run overlapped the live campaign, so I re-ran the
failing areas with nothing else running: **4 failed, a mostly different set**
— `durable-patches` and `instruction-readiness` failed only in the quiet run,
`adaptive-loop`, `recovery-trace`, `catalog`, `rejections`, `flow-map` and
`runs` only in the loaded one. A failure set that changes between runs is this
machine's documented behaviour, not a defect.

I then ran the two files that failed **both** times in isolation:

- `service-adaptation/tests/modes.test.ts` — **4 passed, 0 failed** alone. Its
  individual tests take 4–10 seconds each against vitest's 15-second default,
  so any concurrency times them out. This is the file nearest my change (it
  exercises the runtime adaptation context that `verify_result` extends), which
  is why I chased it specifically.
- `service-flows/tests/scale-pages.test.ts` — **3 passed, 0 failed** alone, and
  the assertion that failed under load passed in **861ms** against its own
  60-second timeout. Its failure is an explicit performance budget
  (`expected 541.88 to be less than 500`) over 10,000 Subflow summaries, in code
  this task does not touch.

Both files that failed twice pass in isolation, so no Core failure survives a
quiet rerun.

I did **not** rerun all fifteen individually. None of them is in
`result-verification` or `llm`, both of which passed completely
(48/48 and 347/347).

**Typechecks.** `pnpm --filter fluxiq build` (which is `tsc -b`) exit 0.
`npx tsc --noEmit` in `packages/fluxiq`, which covers Core's tests too, exit 0
with no output. `npx tsc -p packages/test-contracts/tsconfig.json --noEmit` and
`npx tsc -p packages/test-runner/tsconfig.json --noEmit` both clean.

## Files changed

Core (`F:\fxwork\t012\!FluxIQ`) — all inherited, none changed by me beyond
reverting my two mutations:
`AS/api/contracts/llm.ts`; `AS/runtime/llm/{execution-grants,grant-capabilities,runtime-session-grant}.ts`;
`AS/runtime/loop-limits/result-summary.ts`;
`AS/runtime/result-verification/{contracts,core-observation,index,result-summary,run-outcome,verification-status}.ts`
and six test files.

Downstream (`F:\fxwork\t012\!FluxIQWebExtension`) — mine:
`packages/test-contracts/src/{evaluation,evaluation-validation}.ts`;
`packages/test-runner/src/live-llm/{live-llm-plan,execution-grant,authorize-flow,live-llm-run}.ts`;
`packages/test-runner/src/flow-lane/{persisted-flow-run,lane-observation}.ts`;
`packages/test-runner/src/flow-lane/creation/{lane,snapshot}.ts`;
`packages/test-runner/src/run-scenario.ts`; four test files.

## Two things the supervisor asked about

**The `preflight-llm-execution` 400 was mine, not a pre-existing bug.** Core
holds a grant's run token budget to what its own calls could spend
(`execution-grants.ts`: `maxTotalTokensPerRun > perCallTokens * maxCalls` is
refused). My first `verify_result` grant asked for one call and the campaign's
whole 600,000-token run budget, so Core refused it —
`run-mu7chivm-77733e0e`, before any Flow ran. Fixed by narrowing the budget to
`perCallTokens × maxCalls`; `run-mu7co5cz-84222d5b` then issued and spent the
grant cleanly. It is unrelated to the pre-existing `lab.generation_http_400` on
the generation path.

**The t010 in-place link-click fix cannot have affected my headline
measurement.** `git merge dev` is refused in this worktree by the worker hook
("workers must not change git history"), so I could not merge and re-measure;
the supervisor must do that. But the question is answerable from the runs
themselves: the Flow that DeepSeek built for
`property-listings-newest-homes` performed **no click at all** — its whole
action list, in both the baseline and the fixed run, is
`web.browser.navigate` then `web.dom.extract_list`, each `succeeded` with
`comparisonStatus: matched`. There is no cancelled navigation for t010 to have
mis-judged, and the baseline and fixed runs produced byte-identical extraction
measurements. The `passed` → `failed` flip is attributable to the verification
call and nothing else.

`order-operations-batch-export` is a different matter: it narrows an order book
with filter controls, so it plausibly does click a link whose navigation the
page cancels. **Its result below should be re-measured after `dev` is merged**
before anyone draws a conclusion from it.

## Not verified

- **Whether the `order-operations-batch-export` shape the brief measured (7 rows,
  0 matched) now fails.** Today's run of that task returned 0 rows and was
  caught by a pre-existing check, so the 7-row shape was never re-exercised.
- **Whether `company-directory-logistics-sector` flips.** Reasoned above, not
  measured. I expect `unverified` at worst and do not claim it fails.
- **The Lab's live-LLM accounting does not include the verification call.**
  `settleBuild` publishes the build's own usage and runs before the playback, so
  the one verification call is bounded by Core's grant (1 call, the plan's
  per-call token/cost/timeout ceilings) but is not in the bundle's
  `snapshots/live-llm.json` totals. The campaign's `providerCalls` does count it
  (3 → 5 across the two runs). A real gap, small, deliberately not widened.
- **`pnpm check`, `pnpm test`, `pnpm build` at either repository root — not
  run.** Per the supervisor's live-first instruction. **The structure audit has
  not seen the new Core file** `verification-status.ts`; it is one exported
  function plus its type in a directory that already has a barrel, and the
  barrel exports it, so I expect it to pass — but I have not run it.
- **Thirteen of the fifteen Core suite failures were not rerun individually.**
  They are attributed to load on the evidence that the set changed between
  runs, not on a per-test basis.
- **No non-created-Flow lane was exercised.** The recording lane, the
  existing/clone targets and a deterministic replay were not run, so the claim
  that they keep reporting `passed` rests on the code path and its unit test,
  not on a live run.
- **`unverified` was never produced live.** The verification grant works, so
  every Flow-lane run in this session came back `refuted`. Its mapping is
  covered by unit tests only.
- **`git merge dev` was refused by the worker hook**, so the t010 in-place
  link-click fix is not in the branch these measurements were taken on. Argued
  above to be irrelevant to `property-listings-newest-homes` (its Flow clicked
  nothing) and possibly relevant to `order-operations-batch-export` (which
  performed two `web.dom.select` actions but no click — so probably not, though
  I did not chase it). **The supervisor must merge and re-measure.**
- **Nothing was committed.** Core was rebuilt after the mutation reverts and its
  worktree diff is exactly the inherited file set.
