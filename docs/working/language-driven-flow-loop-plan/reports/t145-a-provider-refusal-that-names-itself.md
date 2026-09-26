# t145 — A provider refusal that names itself

## Outcome

**Done, with one honest correction to the brief's premise.** A non-2xx from
DeepSeek now carries a screened record naming the status, the provider's own
error code, type, param and message, the shape of the request it refused, and
every field withheld with the reason for it. `deepseek/provider.ts` is 811 lines
no more — the directory is eleven modules, the largest 226 lines — and both of
its structure-audit findings are cleared without a baseline entry.

**But those two runs were not a 400 from DeepSeek, and I could not have fixed
them from this directory.** The `400` in their bundles is Core's own route
status, and the code they recorded cannot be produced by a DeepSeek 400 at all.
I traced it to one strong candidate — a refused run-budget reservation — which
never reaches the provider. The three-line change that would name it is in files
this brief forbids, and is written out below. I narrowed the cause; I did not
establish it.

## 1. What `a28365a` captures, and what it still dropped

`a28365a` replaced one line at the `!response.ok` branch with a bounded read of
the body, decoded UTF-8, `.catch(() => undefined)`, passed as the sixth
constructor argument of `AutomationStudioLlmProviderError` (`responseBody`).

What it still dropped, all of it now fixed except the last:

1. **The two statuses a person can act on were not covered.** `401`/`403` and
   `429` were decided *above* `!response.ok` and thrown without the body being
   read, so a rejected credential and an enforced ceiling stayed as mute as
   before. Every non-2xx now goes through one path (`deepSeekRefusalFailure`);
   the codes and their retryability are byte-for-byte what they were.
2. **Nothing about the request.** A 4xx is the provider rejecting the *request*,
   and the error carried only the reply. `request-shape.ts` is the other half.
3. **No screening, so it could never be published.** The raw body rode on the
   error whole. A 400 routinely quotes the field it objected to, which means it
   can quote a page's text straight back — which is exactly why the commit had to
   promise the body would never leave the process.
4. **Withholding was indistinguishable from silence.** `.catch(() => undefined)`
   erased the difference between "the provider sent no body", "the body was over
   the byte ceiling" and "the read itself failed". Each is now a named entry.
5. **It is still not reachable by any reader.** `harness/run.ts` builds the
   failure diagnostic's metadata as `{ retylable, providerStatus }` and nothing
   else, so `responseBody` dies with the throw. That file is another worker's;
   the one-line change is named in section 4.
6. It drew the audit's `failure-as-empty` finding, which is what step 4 of the
   brief was about. Cleared.

### A 400 from DeepSeek does *not* reach `provider_transport_unknown`

Traced end to end, and this matters more than anything else here:

- the adapter throws `llm.provider_http_error` with `status: 400`;
- `harness/run.ts:157` normalizes it, keeping the code and putting the status in
  `metadata.providerStatus`;
- `flow-bootstrap/generation-failure.ts:619` has an **explicit arm** for
  `llm.provider_http_error` → `flow_bootstrap.provider_http_error`, with
  `providerResponse: "received"` and `accounting.providerStatus: 400`.

So a real DeepSeek 400 was already a named code carrying its status, before
`a28365a` and after it. **Neither of the two runs recorded that**, which is the
finding of section 3.

## 2. What the refusal now carries, and what it names as withheld

`deepseek/refusal.ts`. The record is JSON-encoded into the existing
`responseBody` slot, because a typed field on the error would mean editing
`provider-contract.ts`, which this brief does not give me.

```
{ status, contentType, bodyBytes,
  error: { code, type, param, message } | null,
  withheld: [...],
  request: <shape> }
```

**The provider's side.** `code`, `type` and `param` must match
`^[\w.:\-[\]]{1,120}$`. That allow-list is deliberately *stronger* than the
locator screen for these three: it admits `invalid_request_error`, `max_tokens`
and `messages[1].content` — the field path is what makes a 400 actionable — while
refusing every shape that addresses an element, because each of those needs a
quote, an equals sign, a slash or a sigil and none is admitted. A numeric `code`
is rendered as its decimal; anything else becomes `null` with
`error_fields_unnamed`.

`message` is prose, so it gets the treatment the rest of this program gives free
text on its way to a model: dropped whole if the configured credential appears
anywhere in it (`message_credential_shaped`), then run through
`automationStudioWithoutLocators` from `harness/locator-text.ts` — the same
screen, not a copy of it — with `message_locator_shaped` recorded when it changed
anything, then cut at 400 characters with `message_truncated`.

**The request's side** (`request-shape.ts`) is counts, bounds, booleans and ids
this repository minted, and nothing else:

- `model`, `taskKind`, `promptVersion`, `stage`, `expectedOutput`, `timeoutMs`;
- `requestId` and `idempotencyKey` — Core's own ids, and the only place a retried
  or duplicated call is visible at all;
- `bodyBytes`, `responseFormat`;
- `messages`, one entry per chat message: `{ role, bytes, empty }`. A test
  asserts those three keys exactly, so an edit that adds message text fails;
- `tokens`: `measuredInput` (what this adapter measures) against `declaredInput`
  (what the harness computed and the pre-flight checked), the three ceilings, and
  `inputHeadroom` / `totalHeadroom`;
- `outputSchema: { offered, bytes }`, `toolIds` (tool ids, by id), `evidence:
  { calls, iteration }`, `catalog: { entries, bytes, truncated }`,
  `exploredPackets`;
- `malformed`: the **names** of fields that arrived empty or disagreed with
  themselves — `messages[1].content`, `context.instructions`,
  `context.evidenceLoop.tools`, `context.flowBootstrap.nodeCatalog`,
  `outputSchema`, `estimatedInputTokens`, `tokenLimits.maxInputTokens`,
  `tokenLimits.maxTotalTokens`. An empty list is itself the finding: the provider
  refused something this adapter can see nothing wrong with, so read what the
  provider said.

**The withheld vocabulary**, every omission named: `body_unreadable`,
`body_over_limit`, `body_empty`, `body_not_json`, `error_object_absent`,
`error_fields_unnamed`, `message_truncated`, `message_locator_shaped`,
`message_credential_shaped`.

A non-JSON body is answered with its declared media type and its size and
nothing else — an interposed proxy's error page is the usual case, and its prose
is not the provider's. A body too large to hold, or a read that fails, does not
replace the status: the read's own refusal becomes a `withheld` entry and the
status's code is thrown as it would have been. That is `a28365a`'s rule with the
reason named instead of erased.

## 3. Why those two runs got `unknown`. Narrowed, not established.

**The `httpStatus: 400` is Core's, not DeepSeek's.** t138 established it:
`flow-lane/creation/build-proposal.ts:417` writes `httpStatus: envelope.status`,
and `envelope` is the Lab's own HTTP call to Core's route. Core refused the Lab's
build request with 400 and a diagnostic. "An intermittent 400 from the provider"
was never the right reading.

**What the runs actually recorded** (`test-runs/run-muhs8hx3-6fd929e6/snapshots/live-llm.json`,
and the same shape in `run-muhtuizo-c458e49c`):

```
build.failure   = { code: "flow_bootstrap.provider_transport_unknown",
                    stage: "provider_request", httpStatus: 400 }
build.providerCalls = null   loopProviderCalls = null   evidenceLoop = null
build.accounting = { provider: "deepseek", model: "deepseek-flash",
                     inputTokens: null, outputTokens: null,
                     totalTokens: null, estimatedCostUsd: null }
build.durationMs = 167200          (193832 in the second run)
observed.calls   = 1
```

No `providerStatus` in accounting. A DeepSeek 400 would have put one there and
would have been `flow_bootstrap.provider_http_error`. So **DeepSeek did not
answer 400 on either run.**

**`flow_bootstrap.provider_transport_unknown` has two producers**, both in
`generation-failure.ts`: the explicit arm for `llm.provider_request_failed`
(line 643) and the `default` arm (line 647) for any code that is neither a
recognised `llm.provider_*` code nor `llm_output.*` / `bootstrap.*` /
`llm.provider_diagnostic`. Every one of the 15 call codes and 20 pre-flight
codes in `provider-contract.ts` has its own arm, so **the code Core held was not
one the DeepSeek adapter can throw**.

**The candidate that fits every recorded field.** `harness/run.ts:127-146`: when
the run-budget reservation is refused, the harness returns `ok: false` **with
`provider: input.provider.metadata`** and one diagnostic whose code is one of the
six from `runtime/llm/run-budget.ts:153-176` — `llm_budget.run_call_limit`,
`run_total_limit`, `run_output_limit`, `run_cost_limit`, `duplicate_request`,
`invalid_reservation`. None has an arm in the projection. And because
`input.provider` is present, `flowBootstrapHarnessFailure` takes the
provider-request branch rather than the pre-provider branch that *does* map
budget codes (`preProviderHarnessFailureCode` handles
`llm_budget.input_limit_exceeded` and friends, but none of those six). The result
is precisely what the two runs recorded: `provider_transport_unknown`, stage
`provider_request`, `providerInvocation: "attempted"` — untrue, no request was
made — `providerResponse: "unknown"`, accounting with provider and model, no
usage, no status.

The 167-second and 194-second build durations support it: the per-call deadline
was 25,000 ms, so no single refused HTTP exchange accounts for that time.

**Which of the six it was cannot be recovered from the bundle**, because the
bundle keeps only the projected code. `llm_budget.duplicate_request` is the one
that would explain intermittency on an identical configuration — it fires when a
`requestId` is reserved twice in a run — which is why `requestId` and
`idempotencyKey` are in the refusal's request shape: that pair is the only place
a repeated call is visible.

**Said plainly: a budget refusal never reaches the provider, so nothing I can put
in `deepseek/` will catch it.** What the shape *does* catch is the property that
genuinely varies between two attempts on identical CLI caps —
`tokens.measuredInput` against `inputHeadroom` and `totalHeadroom`, because the
node catalog, the instruction and the evidence window differ per run, so two runs
launched with the same `--llm-max-input-tokens 48000` do not send the same number
of them.

## 4. Changes needed outside this directory, described and not made

1. **`runtime/flow-bootstrap/generation-failure.ts`** — give the six
   `llm_budget.run_*` / `duplicate_request` / `invalid_reservation` codes their
   own arms. They are already a named vocabulary; they are being reported as an
   attempted provider request with an unknown answer. **Also a live
   contradiction**: the comment at ~line 146 says
   `flow_bootstrap.provider_transport_unknown` is "No longer produced. Kept so a
   diagnostic stored before the refusals were split still parses." Lines 643 and
   647 produce it, and two runs recorded it four commits later. Either the
   comment or the default arm is wrong.
2. **`runtime/llm/harness/run.ts:127-146`** — a refused reservation returns
   `provider: input.provider.metadata` although no request was made, and that is
   what routes a pre-provider failure into the provider-request projection.
   Either omit the provider there or give the refusal its own stage.
3. **`runtime/llm/harness/run.ts:157-175`** — the one change that makes any of
   this visible: `metadata: { retryable, providerStatus }` → `+ providerRefusal:
   error.responseBody`. It lands in `accounting` and travels to the Lab, whose
   sidecar already reads `accounting.providerBody` and records `null` (t138).
   `runtime/llm/tests/harness.test.ts:453-484` asserts that metadata object
   exactly and would need updating. **Until this is done the refusal record
   exists only on the thrown error**, which is honest but is not yet a
   diagnostic anyone reads.
4. **`runtime/llm/provider-contract.ts`** — the record rides in `responseBody`
   JSON-encoded. A typed `refusal?` field would be better, and the type would
   have to sit outside `deepseek/` to stay provider-neutral.
5. **The published-bundle decision `a28365a` deferred** can now be taken: every
   field is screened, so there is a defensible answer to "may a run's bundle
   carry this". Nothing here assumes it.

## 5. The split

`deepseek/provider.ts` was 811 lines and held the pre-flight checks, the prompt,
the schemas, the outbound body, the reply parser and the call. It is now the call
and nothing else. Nothing was extracted and dropped: every comment travelled with
its code, and each new module has a header saying what it owns.

| file | lines | owns |
| --- | --- | --- |
| `provider.ts` | 226 | the adapter factory and the call |
| `refusal.ts` | 199 | what a refusal says, and what it withholds |
| `request-shape.ts` | 174 | what may be said about a request without quoting it |
| `response-envelope.ts` | 166 | what came back |
| `preflight.ts` | 164 | what a request must satisfy before it is sent |
| `request-body.ts` | 160 | what goes on the wire, and its token estimate |
| `output-schema.ts` | 72 | the shape the answer must satisfy |
| `system-prompt.ts` | 61 | what the model is told |
| `bounded-read.ts` | 49 | how much of a reply is read, and the byte ceilings |
| `index.ts` | 46 | the barrel |
| `json-record.ts` | 12 | the record test the three JSON readers share |
| `tests/refusal.test.ts` | 300 | 13 tests |

No subdirectory: `deepseek/` already sits at the audit's nine-segment depth
limit, so a nested folder would fail the non-ratcheting depth rule. The rule that
turns three shared filename prefixes into a directory skips this directory for
the same reason (`naming.mjs:95`), which is what makes `request-body` /
`request-shape` legitimate flat.

**The barrel's surface is unchanged** plus the refusal exports. Every importer in
Core goes through `deepseek/index.ts` — checked — so nothing outside this
directory needed an edit, and none was made.

## Commands run and observed results

From `F:\!FluxIQ\packages\fluxiq`:

- `npx tsc --noEmit` → **exit 0, zero error lines.** The first run reported one
  error, in another worker's new
  `runtime/llm/evidence-loop/tests/rerun-request.test.ts` (TS2375 on
  `AutomationStudioFlowDraftAmendment.input`); it was gone by the final run, and
  no error ever named a file of mine.
- `npx vitest run src/programs/automation-studio/runtime/llm/deepseek` →
  **2 files, 20 tests, all passed** (13 new, 7 pre-existing), 2.49 s.
- `npx vitest run src/programs/automation-studio/runtime/llm` → **50 files,
  528 tests, all passed**, 8.31 s. Run because the tests that exercise this
  adapter mostly live outside the directory I own.
- `npx vitest run` over the five provider tests that live outside `deepseek/`
  (`runtime/tests/deepseek-recovery-requests`, `runtime/tests/llm-deepseek-flow-bootstrap`,
  `runtime/llm/tests/deepseek-provider`, `.../provider-cache-prefix`,
  `.../deepseek-evidence-preflight`) → **5 files, 73 tests, all passed**, 6.95 s.

From `F:\!FluxIQ`:

- `node scripts/structure-audit.mjs` **before**: 4 violations —
  `failure-as-empty` on `deepseek/provider.ts` line 248 (from `a28365a`),
  `file-lines` on `deepseek/provider.ts` (811), on
  `flow-bootstrap/generation-failure.ts` (817) and on `llm/evidence-loop.ts`
  (941).
- `node scripts/structure-audit.mjs` **after**: **1 violation** —
  `file-lines` on `flow-bootstrap/generation-failure.ts`, 817 lines. **My
  directory is clear of findings, with no baseline entry.** `evidence-loop.ts`
  was already red before I started and was cleared by the worker in it, not by
  me. `generation-failure.ts` was already red and I did not touch it.
- The audit also says "1 baseline entries can be lowered".
  `node scripts/structure-audit.mjs --json` names it:
  `failure-as-empty` on `runtime/service.ts`, 16 against a recorded 18 — somebody
  else's improvement. **I did not run `pnpm structure:baseline`.**

### The 13 tests, by what they hold

A 400 with a JSON error body (everything carried, `withheld: []`); the request
shape carried on a refusal, including the assertion that a message entry has
exactly `role`/`bytes`/`empty` and that neither the instruction's text nor the
outbound user message appears anywhere in the record; a 400 with a non-JSON body
(`body_not_json`, media type and size only, body text absent); a 429 (now says
*why*, `retryable: true`); a 401 (now says why, code unchanged); a message
quoting `[data-testid="cart-total"]` (`message_locator_shaped`, `[locator
withheld]` present, `data-testid` absent); a message echoing the credential
(`message_credential_shaped`, message `null`, secret absent from the record); a
message over the length bound (`message_truncated`, tail absent); JSON with no
error (`error_object_absent`); an error whose `code` is an object and whose
`param` is a selector (`error_fields_unnamed`, both `null`, `aria-label` absent);
an empty body (`body_empty`); a refusal body over a 512-byte ceiling
(`body_over_limit`, and the thrown code is still `llm.provider_http_error`, not
`llm.provider_response_oversize`); the tool ids and evidence counts of an
exploration request; `malformed` naming `context.instructions` and
`estimatedInputTokens`.

## Not verified

- **No live run.** The refusal record has never been produced by a real DeepSeek
  refusal. It cannot be until change 3 in section 4 is made, because nothing
  outside the throw can see it.
- **The cause of the two runs.** Narrowed to a refused run-budget reservation,
  ruled out as a DeepSeek 400, not proved. Proving it needs the six budget codes
  given their own arms and one more run that fails the same way.
- **`llm.provider_request_failed` as the alternative producer.** I could not find
  a throw path that reaches it — the adapter's `runTask` catch wraps every
  foreign throw as `llm.provider_request_setup_failed`, and
  `runProviderWithEnforcedDeadline` rejects with a real provider error — but I
  cannot prove no such path exists.
- **Where the 167 and 194 seconds went.** Unexplained. One refused HTTP exchange
  against a 25,000 ms deadline does not account for it.
- **The oversize path against a real streamed body.** The test drives it through
  the chunk-counting branch of `readAutomationStudioDeepSeekBoundedResponse`; the
  declared-`content-length` branch is not separately exercised for a refusal.
- **`pnpm check` / `pnpm test` / a Core build.** Not run: the brief forbids
  building Core, and four other workers are editing this tree.

## Open questions

- **Is `providerInvocation: "attempted"` on a pre-provider failure a bug worth a
  task of its own?** It is a positive claim that a request was made, recorded for
  failures where none was, and `phaseFailureStateMatches` *requires* it for the
  `provider_request` stage — so the stored diagnostic cannot express the truth.
  That is the same defect the grant-refusal codes were split out of at `a8cc85e`,
  one layer up.
- **Should the refusal be published?** Every field is now screened and named, so
  the answer could be yes, and the Lab's sidecar has the field waiting. That is a
  decision about the published bundle, not a code change.
- **`runtime/llm/evidence-loop.ts` and `runtime/llm/evidence-loop/` both exist**
  in the working tree right now. `preflight.ts` and `system-prompt.ts` import
  `../evidence-loop.ts`, unchanged from what `provider.ts` imported. Whoever
  finishes that split owns updating these two importers.
