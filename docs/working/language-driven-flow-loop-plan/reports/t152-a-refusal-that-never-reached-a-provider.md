# t152 — A refusal that never reached a provider

## Outcome

**Done, with one hop blocked and one of t145's premises corrected.**

A refused run-budget reservation no longer presents provider metadata, every
result the harness returns now states as a fact whether a request reached the
provider, and a non-2xx carries the screened refusal out of the harness as a
typed field. Verified end to end: a refused reservation now projects to
`flow_bootstrap.run_budget_calls_exhausted`, stage `pre_provider_validation`,
`providerInvocation: "not_attempted"`, and round-trips through the stored
diagnostic's parser unchanged.

**Blocked:** the last hop of item 3 — the refusal reaching `accounting` — cannot
be made from my files. `accounting`'s shape and its exact-field parser live in
`runtime/flow-bootstrap/generation-failure`, which the brief forbids. The exact
patch is in section 5.

**Corrected:** t145's candidate for the two live runs cannot be right. **The Flow
Bootstrap build path passes no run budget at all**, so the branch t145 identified
is unreachable for a build. Section 4. My change is still the right change; it
does not explain those two runs.

## 1. A refusal that never called a provider no longer names one

`harness/run.ts`, the refused-reservation return. It carried
`provider: input.provider.metadata` and passed the same metadata to the
intervention. Both are gone, and the return states
`providerInvocation: "not_attempted"`.

The metadata was the whole mechanism of the lie:
`flowBootstrapHarnessFailure` branches on `!input.provider`, so its presence put
a failure made *before* the call into the provider-request projection. It also
made the intervention name a provider and a model for a call that never happened.

`AutomationStudioLlmTaskResult.provider` is now documented as *the provider a
request was actually sent to*, which is what every other return already meant by
it, and the fact a reader should route on is the new field beside it.

## 2. `providerInvocation`, stated on every path

New **required** field on `AutomationStudioLlmTaskResult`, typed with the
existing `AutomationStudioLlmProviderInvocationState` (`not_attempted` /
`attempted` / `unknown`). Required, so a new return path cannot forget it.

| return | value | why |
| --- | --- | --- |
| budget/limit/stage-order refusal | `not_attempted` | nothing was sent |
| dry run, no provider configured | `not_attempted` | nothing was sent |
| **refused run-budget reservation** | `not_attempted` | the defect above |
| provider threw | `failure.provenance.providerInvocation` | the failure's own account |
| provider result unparseable | `attempted` | a reply arrived |
| success | `attempted` | — |

The catch taking the failure's provenance is the part that earns its keep beyond
the budget case: an adapter pre-flight refusal (`llm.provider_request_*`) reads
`not_attempted` although `runTask` ran, a transport error reads `attempted`, and
a deadline or cancellation reads `unknown` rather than claiming either.

**`phaseFailureStateMatches` needed no change, and loosening it would have been
wrong.** The brief expected a stage that "requires attempted" to be taught to
accept the truth. It does require it — for stage `provider_request`, where the
requirement is *correct*: that stage means a request was made. The defect was
never that the state was inexpressible (the pre-provider stage produces
`not_attempted` today, and the published contract at
`api/contracts/adaptation.ts` has listed both states all along); it was that the
failure was filed under the wrong stage. Fixing the stage makes the state
honest. Loosening the matcher would instead have let a `provider_request`
diagnostic say no request was made, which is a contradiction the parser is there
to refuse.

Every reader of `providerInvocation` was checked: `generation-failure/` (type,
parser, producers, state table), `api/contracts/adaptation.ts` (both states,
published), `recovery/refuted-result/reauthor.ts` (optional, both states),
`runtime/service.ts:2673` (copies it). None needed widening.

## 3. The screened refusal, typed and carried out of the harness

New module `runtime/llm/refusal-record.ts` (267 lines) —
`AutomationStudioLlmProviderRefusal`, its bounds, and
`parseAutomationStudioLlmProviderRefusal`. Provider-neutral, as t145 required:
a refusal is a status, what the provider said about it, the shape of the request
it refused, and what was deliberately left out.

- `AutomationStudioLlmProviderError` gains a typed `refusal` parameter, so a new
  adapter passes the record instead of encoding it.
- `normalizedAutomationStudioLlmProviderFailure` returns `refusal`, read **only
  from a real error instance** — `error.refusal ?? parse(error.responseBody)`.
  A structurally typed clone's claimed record is not read, for the same reason
  its `provenance` and `message` are not: code, retryability and status are read
  because each is checked against Core's vocabulary and ranges, and a refusal
  record cannot be checked that way. What makes it publishable is the screen the
  producing adapter ran.
- `harness/run.ts` puts it on the result as `providerRefusal`.
- Exported from the `runtime/llm/` barrel so a reader outside can name the type.

**Why the contract parses `responseBody` rather than deepseek passing the typed
field.** `deepseek/` is forbidden this task, and that is where the record is
built and JSON-encoded. The parse is not a workaround: it is the neutral seam —
any adapter that encodes a refusal there gets it typed and bounded centrally,
and the typed parameter is there for the next adapter (and for `deepseek/` when
it is next touched: one-line change, `said` → the record).

**What the parse enforces**, on top of the producer's screening (which it
documents rather than repeats — it has no credential to compare against):

- no status in 100–599 → **no record**. A refusal is a status.
- `withheld` present but not a list of `^[a-z0-9_]{1,40}$` names, or longer than
  32 → **no record**. The entries are the only thing between a dropped field and
  a silent absence; a record whose own account of its omissions cannot be read
  is not carried.
- `code`/`type`/`param` must match `^[\w.:\-[\]/]*$` within 120 characters —
  admits `invalid_request_error`, `max_tokens`, `messages[1].content`, refuses
  every shape that addresses an element (each needs a quote, an equals sign, a
  sigil or whitespace). A miss becomes `null` plus `error_fields_unnamed`.
- `message` bounded at 400 characters, with `message_truncated`.
- `contentType` may carry its parameters (`text/html; charset=utf-8`) and
  nothing bracketed or quoted.
- **the request shape is carried only if every string in it is a name**, bounded
  at 200 characters, 8 deep, 500 wide. A producer that adds a text-bearing field
  loses the shape rather than publishing the text, and the loss is named
  `request_unpublishable`.

## 4. Where the refusal stops today, and what the two runs actually were

Observed, with a scratch test since deleted:

```
HARNESS RESULT REFUSAL {"status":400,"contentType":"application/json","bodyBytes":90,
  "error":{"code":"invalid_value","type":"invalid_request_error","param":"max_tokens","message":"too large"},
  "request":{"model":"deepseek-flash","taskKind":"runtime_diagnosis"},"withheld":[]}
STORED DIAGNOSTIC {"code":"flow_bootstrap.provider_http_error","stage":"provider_request",
  "retryable":false,"providerInvocation":"attempted","providerResponse":"received",
  "accounting":{"requestId":"request.refusal","estimatedInputTokens":161,
  "provider":"deepseek","model":"deepseek-flash","providerStatus":400}}
```

The record reaches the harness's caller and stops there. Nothing in
`generation-failure/` reads it.

And the refused reservation, same method:

```
PROJECTED {"code":"flow_bootstrap.run_budget_calls_exhausted","stage":"pre_provider_validation",
  "retryable":false,"providerInvocation":"not_attempted","providerResponse":"not_received",
  "accounting":{"requestId":"request.second","estimatedInputTokens":160}}
REPARSED  <identical>
```

### The two live runs were not a refused reservation

`runBudget` is passed to the harness by exactly three production callers —
`recovery/annotation/exploration.ts`, `recovery/annotation/patch-reserve.ts` and
`result-verification/verify.ts`. **The Flow Bootstrap build passes none**, so
`reservation` is `null` for a build and the branch t145 narrowed to cannot fire
on one. `run-muhs8hx3-6fd929e6` and `run-muhtuizo-c458e49c` were builds
(`build.failure`, `build.accounting`, `build.durationMs`).

The producer that matches every field those bundles recorded — code
`provider_transport_unknown`, stage `provider_request`,
`providerInvocation: "attempted"`, `providerResponse: "unknown"`, provider and
model in accounting, **no** `providerStatus`, no usage — is
`llm.provider_request_failed`, which
`normalizedAutomationStudioLlmProviderFailure` returns when a throw cannot be
structurally typed: no `code`, a code outside Core's vocabulary, a non-boolean
`retryable`, or a `status` outside 100–599. t145 could not find a path to it and
said so; I could not either, but it is the only remaining shape that fits, and
it is reachable by construction (any foreign throw that escapes the adapter's own
catch).

### Where the 167 and 194 seconds went

They are the calls that happened *before* the failing one, and the bundle never
said otherwise.

A build explores: `runtime/tests/deepseek-bootstrap-exploration.test.ts` has
single builds making sixteen-plus decisions and taking 30–60 s of test time
each. `flowBootstrapHarnessFailure` attaches **no** evidence-loop counts and
**no** per-call usage — it carries `input.usage`, which a failed call does not
have — and `build.providerCalls` is populated only by a build that succeeded.
So `evidenceLoop: null`, `providerCalls: null` and null token totals are what a
harness-projected build failure looks like **however many calls preceded it**.
They were read as evidence that no call was made; they are not evidence either
way.

Against a 25,000 ms per-call deadline, 167 s and 194 s are roughly ten to twelve
calls at 15–20 s each — an ordinary exploration, ending on one throw the
projection could not name. Nothing is unaccounted for.

Related, for whoever picks up the budget codes: the run-budget cost ceiling
compares the *per-request* allowance against the *per-run* one
(`state.estimatedCostUsd + reservedCost + (input.maxEstimatedCostUsd ?? 0.25) >
(maxEstimatedCostUsdPerRun ?? 0.25)`), and the Lab passes `--llm-max-cost-usd
0.25` while Core defaults the per-run ceiling to the same 0.25. On the paths that
*do* carry a run budget, that arithmetic allows one call and refuses the second
with `llm_budget.run_cost_limit`. Worth checking against a repair run's receipt;
it is not this task's to change.

## 5. The remaining hop, exactly

In `runtime/flow-bootstrap/generation-failure/` — another worker's, and it was
split from the 817-line file into a ten-module directory while I worked:

1. `diagnostic.ts`: add `providerRefusal?: AutomationStudioLlmProviderRefusal` to
   `accounting` (or beside it — see the note below).
2. `diagnostic-parse.ts`: add `"providerRefusal"` to `parseAccounting`'s
   `hasExactFields` list and validate it with
   `parseAutomationStudioLlmProviderRefusal` from `../../llm/index.ts`, which
   already bounds and screens every field. A value that does not parse is
   dropped, not refused: the accounting is still true without it.
3. `harness-failure.ts`: take `providerRefusal?: AutomationStudioLlmProviderRefusal`
   on the input (it arrives on the harness result, typed) and write it into
   `accounting` beside `providerStatus`.

**Note on placement.** A refusal is not a cost, so `accounting` is a slightly
odd home; the brief asks for it because `accounting` is what the Lab's sidecar
reads (t138: it already reads `accounting.providerBody` and records `null`). If
the field is named `providerRefusal`, the Lab sidecar needs a one-line change
too. Naming it `providerBody` would flow through unchanged and be a worse name.

**Two things in that directory are now stale because of this task** (both
comments, no behaviour): `harness-vocabulary.ts` and `harness-failure.ts` say
"the harness refuses the reservation and returns the provider's metadata
anyway". It does not any more. Their run-budget arm in
`resolvedProviderHarnessFailure` is consequently unreachable from the harness —
harmless and worth keeping as belt-and-braces, but the comment should say so.

A third comment goes stale the moment the hop is made: `deepseek/index.ts` says
the refusal "rides on the thrown failure's `responseBody` and is never
published". Both halves change — it is read into a typed field, and the point of
the hop is that a run's record carries it. `deepseek/` was forbidden this task.

**One integration question for the supervisor.** Their arm kept `provider` and
`model` in a refused reservation's accounting; mine routes the same refusal
through the pre-provider branch, whose accounting is `requestId` and
`estimatedInputTokens` only. Same code, same stage, same state — the only
difference is those two labels. If they are wanted for a call that never
happened, the honest way is a field that names the *configured* provider rather
than the one that answered.

## Commands run and observed results

From `F:\!FluxIQ\packages\fluxiq`:

- `npx tsc --noEmit` → **exit 0, no output.** Run three times: once mid-way (two
  errors, both mine, both fixed — a type imported from the wrong module, and one
  test double missing the new required field), and twice clean, the last after
  the `generation-failure/` split landed in the tree.
- `npx vitest run src/programs/automation-studio/runtime/llm` → **52 files,
  544 tests, all passed**, 10.55 s. t145's 50 files / 528 tests plus my two files
  and 16 tests; no pre-existing test needed changing.
- `npx vitest run src/programs/automation-studio/runtime/tests` → **74 files,
  493 tests, all passed**, 116.88 s.
- The two suites run together earlier → 124 files, 1019 passed, **2 failed**:
  `service-adaptation/tests/modes.test.ts` and
  `service-flows/tests/instruction-readiness.test.ts`, both `Test timed out in
  15000ms`, no assertion failure. **Re-run alone: 2 files, 5 tests, all passed**
  (21.3 s and 14.8 s — both within a hair of the 15 s limit under load), and both
  passed again in the 74-file run. Load starvation, not my change; other workers
  were validating the same tree.

From `F:\!FluxIQ`:

- `node scripts/structure-audit.mjs` → **`structure-audit: passed (182
  warnings, 358 baselined)`. Zero violations.** The `file-lines` FAIL on
  `generation-failure.ts` (817) that t145 recorded is gone: that worker split the
  file. Nothing in the output names any file of mine — checked by grepping the
  full output for each of them. `refusal-record.ts` is 267 lines,
  `provider-contract.ts` 278, `harness/run.ts` 261, all under the 400-line
  advisory.
- The audit still says one baseline entry can be lowered:
  `failure-as-empty` on `runtime/service.ts`, 16 against a recorded 18 — somebody
  else's improvement, same as t145 saw. **I did not run `pnpm
  structure:baseline`.**

`provider-contract.ts` carries a `failure-as-empty` baseline of 1, so the new
parse deliberately answers a failed `JSON.parse` with `{ unreadable: true }`
rather than `undefined`, which is also the honest shape: a caller can tell a
failure carrying no refusal from one carrying something unreadable.

### The 16 new tests

`harness/tests/run.test.ts` (6): a refused reservation says `not_attempted`,
names no provider in the result *or* the intervention, and the provider is asked
exactly once across the two calls; a dry run, a missing provider and a
self-made budget refusal all say `not_attempted`; a timeout says `unknown`, an
adapter pre-flight refusal says `not_attempted`, an HTTP error says `attempted`
**and its diagnostic metadata is still exactly `{ retryable, providerStatus }`**;
the real DeepSeek adapter answering 400 through a stubbed fetch carries the
screened refusal, its request shape, and none of the instruction's text; a
cloned foreign error's claimed refusal is not read; a successful call says
`attempted` and names the provider.

`tests/refusal-record.test.ts` (10): object and JSON string parse identically;
absent rather than empty where there is no record; no status → no record (six
shapes); an unreadable `withheld` → no record; the message bounded with its
omission named and the tail gone; a non-name error field dropped with
`error_fields_unnamed` and `data-testid` absent; the producer's omissions kept
beside added ones without repeating; a request shape holding prose or a locator
dropped with `request_unpublishable` and the text gone; a too-deep shape dropped;
a media type with parameters kept and a bracketed one dropped.

## Not verified

- **No live run.** The refusal record has still never been produced by a real
  DeepSeek refusal, and it still reaches no stored record until section 5's hop
  is made.
- **Which throw produced the two runs' failure.** Narrowed to
  `llm.provider_request_failed` by elimination and by ruling out t145's
  candidate; not established. What would establish it: the default arm in
  `resolvedProviderHarnessFailure` recording the unrecognised code as an
  `issueCode`. That is in the forbidden directory.
- **`accounting.providerRefusal` end to end**, including the Lab sidecar. Blocked.
- **`pnpm check` / `pnpm test` / a Core build.** Not run: the brief forbids
  building Core, and at least one other worker was editing this tree throughout
  (`generation-failure.ts` became a directory mid-task).
- **The run-budget cost arithmetic** in section 4's last paragraph is read from
  the code and the Lab's CLI defaults, not observed in a run.

## Open questions or contradictions found

1. **The brief's items 2 and 3 both have tails inside a file it forbids.** Item 2
   resolved without it (section 2 — and loosening the matcher would have been
   wrong). Item 3's last hop cannot: `accounting`'s shape and its exact-field
   parser are there. Section 5 is the patch, ready to hand to whoever owns that
   directory now.
2. **Two workers fixed the same failure from opposite ends, and both fixes are
   in.** The brief said not to special-case budget codes at the projection; the
   other worker did exactly that (they were briefed to). The two converge on the
   same code, stage and state, so nothing is broken — but their arm is now
   unreachable from the harness and their comments describe the old harness.
   Someone should reconcile the comments and decide the provider/model question
   at the end of section 5.
3. **`unusable-decision.ts` and `recovery/annotation/exploration.ts` both use
   `!result.provider` to mean "the provider was not reached".** That is now
   exactly what `providerInvocation` says, and reading the field instead of
   inferring from an absence would be a two-line improvement in each. Neither
   file is mine, and behaviour is unchanged either way (a budget refusal already
   answered `false` there, via the diagnostics check rather than the guard).
4. **Should the refusal be published?** Unchanged from t145: every field is
   screened by the producer and bounded by `refusal-record.ts`, the request shape
   now cannot carry a non-name string at all, and the Lab's sidecar has a field
   waiting. The decision is the bundle's, not the code's.
