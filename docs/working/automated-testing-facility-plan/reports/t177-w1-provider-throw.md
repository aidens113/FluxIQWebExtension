# t177-W1: provider_transport_unknown carries its underlying error

## Outcome

Done. An untyped provider throw now reaches the published Flow Bootstrap failure diagnostic as a bounded, screened `providerThrow` record. It is written only beside `flow_bootstrap.provider_transport_unknown`, and the stored record parses back. Typed failures are unchanged, and so is the `issueCodes` behaviour.

## Published field shape (what the Lab reads)

JSON path: `payload.diagnostic.providerThrow`. This is a top-level field of the diagnostic, next to `issueCodes`. It is not under `accounting`.

```json
{
  "errorClass": "TypeError",            // optional; error.name, else constructor name; code-shaped
  "errorCode": "ENOTFOUND",             // optional; error.code (Node system errors)
  "causeClass": "ConnectTimeoutError",  // optional; error.cause's name/constructor (plain Object omitted)
  "causeCode": "UND_ERR_CONNECT_TIMEOUT", // optional; error.cause.code
  "message": "fetch failed (cause: ...)", // optional; screened, <= 240 chars, one line
  "withheld": ["message_credential_shaped"] // optional, non-empty, distinct
}
```

- Code-shaped means `/^[a-z0-9_.:-]{1,100}$/i`, which is Core's `DIAGNOSTIC_ISSUE_CODE`.
- The closed `withheld` vocabulary is `message_credential_shaped`, `message_url_query_shaped`, `message_payload_shaped`, `message_locator_shaped`, `message_truncated` and `throw_unreadable`.
- All fields are optional, but the record is never empty.
- The reader rejects the whole diagnostic if `providerThrow` appears with any other code, has an unknown field, a malformed code, a message that is empty, over 240 characters or contains a control character, or a bad `withheld` list.
- Example from the test: `TypeError('fetch failed', {cause:{code:'ECONNRESET'}})` gives `{"errorClass":"TypeError","causeCode":"ECONNRESET","message":"fetch failed"}`.

## What changed and why

All paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

- **`llm/throw-account/read.ts` + `index.ts` (new).** `automationStudioLlmProviderThrowRead(error)` pulls the class and code of the error and of its cause, keeping only code-shaped values. It also keeps the joined message, with whitespace collapsed and capped at 4000 characters. That message is held apart as `unscreenedMessage` and is never part of `account`. The function never throws; a hostile getter or proxy yields `{account:{withheld:["throw_unreadable"]}}`. This file also exports the types `AutomationStudioLlmProviderThrow`, `...Withheld` and `...Read`, plus `AUTOMATION_STUDIO_LLM_PROVIDER_THROW_LIMITS`.
- **`llm/harness/throw-screen.ts` (new).** `automationStudioLlmScreenedProviderThrow(read)` screens the message. It reuses Core's credential screen (`screenAutomationStudioLlmEvidence(text, []).secretShaped`) and adds a stricter rule for header and key names (`authorization|bearer|api key|x-api-key|cookie|password|secret|sk-…`). It then drops URLs with a query string or fragment and JSON-payload-shaped text. Anything that survives goes through the same `automationStudioWithoutLocators` screen the DeepSeek refusal uses, then is cut to 240 characters. The screens run on the full text before the cut, so a credential beyond the cut still drops the whole message.
- **`llm/provider-contract.ts`.** The untyped arm of the normalizer now returns `thrown?: AutomationStudioLlmProviderThrowRead`. Typed errors return nothing new.
- **`llm/harness/run.ts`.** On `!call.ok`, it screens `failure.thrown` and puts the result on the failure diagnostic's `metadata.providerThrow`. The diagnostic `message` is untouched, since the intervention's `validation.issues` prints the message.
- **`llm/index.ts`.** Now re-exports `./throw-account/index.ts`.
- **`flow-bootstrap/generation-failure/diagnostic.ts`.** Adds `providerThrow?: AutomationStudioLlmProviderThrow` (a type-only import).
- **`flow-bootstrap/generation-failure/diagnostic-parse.ts`.** Adds `parseAutomationStudioFlowBootstrapProviderThrow`, which checks bounds only with the limits written out locally. The vocabulary is `satisfies` the producer's type. The top-level exact-field list now includes `providerThrow`, and the field is only allowed beside `provider_transport_unknown`.
- **`flow-bootstrap/generation-failure/harness-failure.ts`.** When the projected code is `provider_transport_unknown`, it reads `error.metadata.providerThrow` through the reader's parse. That covers both the `llm.provider_request_failed` arm and the `default` arm. A value that fails the parse is left out and the code is kept.
- **Tests.**
  - `llm/throw-account/tests/read.test.ts` (5 tests; imports `provider-contract.ts` first as a guard against import cycles).
  - `llm/harness/tests/throw-screen.test.ts` (12 tests).
  - `llm/harness/tests/run.test.ts` (+2 tests).
  - `flow-bootstrap/generation-failure/tests/provider-throw.test.ts` (19 tests): harness to projection to parse, a JSON round-trip, `Authorization: Bearer x` and an `sk-` key dropped, the default arm, malformed input refused, and refusal beside other codes.

## Design deviation (why two halves)

My first version screened inside the normalizer by importing `./harness.ts`. That closed a module cycle: provider-contract → harness barrel → run.ts → provider-contract. Under vitest's `export *` handling this left `automationStudioWithoutLocators` undefined, and the existing `provider-refusal.test.ts` failed with "automationStudioWithoutLocators is not a function".

Importing the leaf screen files directly from `llm/` instead would create a new `imports` ratchet key, which fails the structure audit. So the normalizer only reads the throw, and the screen runs in `harness/`, on the one path that publishes the message. This is the same way `responseBody` stays on the throw until it is screened.

## Commands run and observed results

- `pnpm exec vitest run --maxWorkers=1 --minWorkers=1 <throw-account/, harness/tests/throw-screen, harness/tests/run, generation-failure/tests/, llm/tests/{harness,failure-disposition,deepseek-evidence-preflight,deepseek-provider}>` (run in `packages/fluxiq`) → `Test Files 12 passed (12)`, `Tests 447 passed (447)`. Passing `--maxWorkers=1` alone errors in vitest 2.1.9 with "minThreads and maxThreads must not conflict", so `--minWorkers=1` is also needed.
- `pnpm exec tsc --noEmit -p .` (in `packages/fluxiq`) → no output, exit 0. The other worker's files were clean at the time.
- `node scripts/structure-audit.mjs` (Core root) → `structure-audit: passed (194 warning(s), 355 baselined)`. It also reported "1 baseline entries can be lowered". That entry does not match any of my paths. An earlier run failed on `llm/tests` having 26 files and on 3 `provider-` prefixed files in `llm/`; moving the helper into `llm/throw-account/` fixed both.

## Not verified

- No live run and no provider call, as the brief requires. I did not test the service.ts path end to end; the projection gets `result.diagnostics` as-is, which I confirmed at `service.ts:1624` and `:1653`.
- I did not run repo-wide tests or `pnpm check`.
- The reader checks bounds only. It cannot re-run the credential or locator screens, which live in `llm/harness`: importing them into generation-failure would add a value edge back into `llm`. This matches how the refusal record's parse works.

## Open questions or contradictions found

- The brief says "carry … from the normalizer". The normalizer now carries the unscreened read and the harness screens it (reason above). The supervisor should accept or redirect this.
- `errorCode` (the error's own `.code`) and `withheld` were added beyond the brief's field list. `errorCode` covers Node system errors thrown without a cause; `withheld` follows the refusal record's rule that nothing is dropped silently.
- The added header and key rule is stricter than Core's credential shapes. For example, it drops any message mentioning "secret" or "cookie". This is deliberate, since page text never reaches this path.
- A thrown string is recorded with `errorClass: "string"`.
