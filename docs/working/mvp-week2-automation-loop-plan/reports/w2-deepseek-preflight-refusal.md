# w2-deepseek-preflight-refusal — worker report

Repository changed: FluxIQ Core (`F:\!FluxIQ`). `AS/` =
`packages/fluxiq/src/programs/automation-studio/`. Nothing in
`F:\!FluxIQWebExtension` was edited apart from this report. No live provider
calls, no network, no `pnpm lab`. Nothing committed.

## Outcome

Done. The check that refused every live recovery is found, reproduced offline
through the real grant path and the real DeepSeek adapter, and fixed at the
root. The reproduction fails without the fix and passes with it. A second
refusal of the same kind, which would have stopped any exploration longer than
16 decisions, is also fixed. Every refusal made before sending now has its own
code.

## Which check fired, and why

**The check:** `validateDeepSeekRequest` in `AS/runtime/llm/deepseek-provider.ts`.
It threw "DeepSeek request contract is invalid." with
`llm.provider_configuration_invalid`, before the credential was resolved and
before `fetch`. The brief's list of seven places leaves this one out. It is a
single large condition, and its failure was passed on unchanged by the
"request construction failed" wrapper.

**The part of that condition that failed:** `validRuntimePromptProjection`,
which checks the recent actions against the adapter's own hard-coded list of
allowed fields: `attemptId, nodeId, definitionId, order, status, route,
durationMs, comparisonStatus`.

**Why:** the packet builder (`AS/runtime/llm/harness/context-packet.ts`,
`compactRecentActionForLlm`) also adds `failureCategory` whenever the attempt's
stored `failure` record parses. The stored run record keeps that record
(`runtime/service/summaries/conversions.ts`). The web domain returns one for a
missing target (`web.target.not_found` becomes `category: "target_not_found"`,
`stage: "target_resolution"`). The recovery path passes
`runDetail: input.detail`, so the failed attempt reached the packet as
`{..., "failureCategory": "target_not_found"}`. The adapter's list had never
been updated for `failureCategory`, so it refused the whole request.

- **It is the same for every token limit.** That is why it reproduced under
  both 8,000/2,000/10,000 and 42,000/8,000/50,000.
- **It hits all three recovery calls.** The adapter checks recent actions for
  every task kind, and the exploration and patch requests carry the same
  `runDetail`.
- **Observed directly, not inferred.** A temporary wrapper around the
  grant-resolved provider (since removed) printed:
  `runtime_diagnosis DeepSeek request contract is invalid. [... {"attemptId":"node.place-order.attempt.1", ..., "failureCategory":"target_not_found"}]`.

**Why CI missed it:** the recovery tests (`recovery/annotation/tests/*`) use a
scripted provider, and their run records carry no `failure`. The adapter tests
build requests by hand, without `failureCategory`.

**Secret reference: not the cause.** The grant passes
`{ kind: "secret_reference", id: grant.keyId }`. Secret Keys mints ids as
`secret:${randomUUID()}` (`secret-keys/runtime/service.ts:111`), which passes
the adapter's pattern. The new test builds the adapter with that exact id
shape, and also runs the grant end to end with it (the credential is revealed
for that id and `fetch` is reached).

## What changed and why

1. **Root cause: one recent-action field list instead of two.**
   `AS/runtime/llm/harness/context-packet.ts` now exports
   `isAutomationStudioLlmRecentActionContext`. It sits beside the projection
   and uses a field table declared
   `satisfies Record<keyof AutomationStudioLlmRecentActionContext, true>`, so a
   field added to the type and missing from the table, or the reverse, fails
   the type check.
   - `failureCategory` is allowed only when it is a real Core category
     (`isAutomationStudioAdaptiveFailureClass`). Any other value is still
     refused, and a test covers that.
   - The adapter's private copy of the list is gone; it calls this check
     instead.
   - `harness/index.ts` exports the new function.
   - No check was loosened. The request was right, and the adapter's list was
     out of date.
2. **Second latent refusal: evidence-loop bounds.**
   `validEvidenceLoopContext` refused `iteration > 16` and more than 16
   evidence items. The loop's own ceilings in
   `runtime/loop-limits/evidence-loop.ts` were deliberately raised to 64, and
   that file's comment says 16 must not become the next hard limit. The
   recovery exploration allows 24 decisions by default, so a real exploration
   would have been refused at decision 17. The adapter now uses
   `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_LIMITS.maxIterations` and
   `.maxToolCalls`. This is a judgement call: it aligns the adapter with the
   loop's current ceiling. It is not a new allowance.
3. **Distinct codes.** `AS/runtime/llm/provider-contract.ts` gains
   `AUTOMATION_STUDIO_LLM_PROVIDER_PREFLIGHT_ERROR_CODES` and the type
   `AutomationStudioLlmProviderPreflightErrorCode`. The adapter uses them as
   follows:
   - **When the adapter is created:** `llm.provider_secret_reference_invalid`,
     `llm.provider_model_unsupported`, `llm.provider_response_limit_invalid`.
   - **The old contract check, now split by check, in order:**
     `llm.provider_request_identity_invalid`,
     `llm.provider_request_scope_invalid`,
     `llm.provider_request_context_unbounded`,
     `llm.provider_recent_actions_invalid`,
     `llm.provider_failure_evidence_invalid`,
     `llm.provider_request_task_mismatch`,
     `llm.provider_flow_bootstrap_context_invalid`,
     `llm.provider_evidence_loop_context_invalid`,
     `llm.provider_request_limits_invalid`.
   - **The remaining checks:** `llm.provider_request_timeout_invalid`,
     `llm.provider_input_budget_exceeded`,
     `llm.provider_credential_in_request`.
   - **The two catch-all wrappers:**
     `llm.provider_request_construction_failed` and
     `llm.provider_request_setup_failed`.
   - **Removed:** `llm.provider_configuration_invalid` is gone from the code
     type and from the recognised-code set, so nothing can throw the vague code
     again.
   - **Codes only:** all of these share one fixed safe message ("refused the
     request before sending it"). The recorded call keeps codes, as before.
   - **Provenance:** the switch still covers every code; any code not handled
     explicitly must be a pre-flight code, or the type check fails.
4. **Code mapping.** `AS/runtime/flow-bootstrap/generation-failure.ts` maps
   each pre-flight code one for one to `flow_bootstrap.provider_<same suffix>`.
   - The mapping table is keyed by the provider's code type, so a new refusal
     fails the type check until it is mapped.
   - The table is written as literals, with only a type import from
     `runtime/llm`. The DeepSeek adapter imports values from
     `flow-bootstrap/`, so a value import back would close a module cycle.
   - The new codes are in the `provider_request` phase list (not retryable,
     "not received").
   - `flow_bootstrap.provider_configuration_invalid` is kept in the list so
     stored diagnostics still parse.
   - `AS/api/**` holds no list of these codes, so nothing changed there. The
     web app compares one bootstrap code as a plain string with a fallback, so
     it is unaffected.
5. **Tests.**
   - **New file:** `AS/runtime/tests/deepseek-recovery-requests.test.ts`. It
     drives `annotateAutomationStudioRunDetailWithRuntimeLlm` into the real
     `createAutomationStudioDeepSeekProvider`, through a real
     `AutomationStudioLlmExecutionGrantService` (only Identity Access, Secret
     Keys and `fetch` are stubbed).
     - The grant is `diagnose_and_adapt`: 26 calls, cost 0.25 per call and 2
       for the run, and a 25 s timeout.
     - It is narrowed with `automationStudioRuntimeSessionGrantTaskKinds`, as
       `programs/_shared/runtime.ts` does.
     - The context comes from `automationStudioRuntimeAdaptationContextForGrant`.
     - The failed run is web-shaped: the attempt and trace carry
       `target_not_found`. The domain declares the web domain's denied keys and
       captures a sanitized page packet of up to 3,000 bytes. Its inspect tool
       returns about 3.4 kB of evidence.
     - **Four cases:**
       - (a) The adapter accepts a `secret:<uuid>` reference.
       - (b) and (c) The diagnosis reaches `fetch` under the 8,000/2,000/10,000
         limits (run budget 260,000) and under 42,000/8,000/50,000 (run budget
         600,000). The record shows `validation: { ok: true, issueCodes: [] }`.
       - (d) All three recovery call kinds reach `fetch`: the diagnosis, 19
         `evidence_tool_decision` calls (iterations 1 to 19, which covers
         iteration 17 and later), and `runtime_patch`. All 21 call records are
         valid, and the exploration ends `evidence_gathered` with 18 actions.
   - **Existing tests updated to the specific codes:**
     `llm/tests/deepseek-provider.test.ts` (it now also sends `failureCategory`
     and checks that an unknown category is refused, plus the three
     construction codes), `llm/tests/evidence-loop-provider.test.ts`,
     `llm/tests/execution-grants.test.ts` (two lines),
     `tests/llm-deepseek-flow-bootstrap.test.ts` (five lines).
   - **Bootstrap mapping tests:** `flow-bootstrap/tests/generation-failure.test.ts`
     checks each of the 17 codes maps to its own bootstrap code that parses
     back, and that the retired combined code still parses.
6. **Size limits held.** `service.ts` is untouched (6434 lines).
   `deepseek-provider.ts` is 711 lines, against an 800-line limit.
   `.structure-baseline.json` is untouched.

## Commands run and observed results

- **Before the fix,** new test:
  `npx vitest run src/programs/automation-studio/runtime/tests/deepseek-recovery-requests.test.ts --root packages/fluxiq`.
  - Production-limits diagnosis: "expected [] to deeply equal
    [ 'runtime_diagnosis' ]". `fetch` was never called.
  - All-kinds case: "expected [] to deeply equal [ 'runtime_diagnosis', …(20) ]".
  - The default-limits case first failed in grant issuing because my test's
    run budget was too big; I fixed the test's budget.
- **After the fix,** same command: 4 passed.
- **Negative control A.** I removed `failureCategory` from the allowed fields,
  which reproduces the old adapter. The three recovery cases fail with
  "expected [] …". File restored and checked byte-identical with `cmp`.
- **Negative control B.** I put the adapter's iteration cap back to 16. The
  all-kinds case fails with "expected [ 'runtime_diagnosis', …(16) ] to deeply
  equal [ 'runtime_diagnosis', …(20) ]". File restored and checked
  byte-identical with `cmp`.
- **Runtime suite:**
  `npx vitest run src/programs/automation-studio/runtime --root packages/fluxiq`
  gave 107 files and 991 tests passed, exit 0, both before and after the
  crash-resume. The brief's baseline was 969; the extra 22 are the 4 new cases,
  17 mapping cases and the retired-code case. No test needed a solo rerun.
- **API tests:**
  `npx vitest run src/programs/automation-studio/api --root packages/fluxiq`
  gave 14 files and 55 tests passed.
- **`pnpm check` in Core: exit 0** on the fourth attempt. Structure tests
  96/96, then "structure-audit: passed (140 warning(s), 254 baselined)", then
  `check: Done` for contracts, client-gateway-websocket, fluxiq and apps/web.
  - Attempt 1 failed with a real finding that I fixed: the `imports` rule
    flagged my test importing `../../llm/provider-contract.ts` instead of the
    barrel.
  - Attempts 2 and 3 died with `tsc` exit 3221225477.
  - One further run died with exit 139, and a standalone audit run failed with
    a parse error inside `typescript.js` itself (`77}` where the file has
    `77]`).
  - All of these are the faulty-RAM signature. `npx tsc --noEmit` run alone in
    `packages/fluxiq` exited 0 with no output, and attempt 4 passed.
- **Audit JSON:** `node scripts/structure-audit.mjs --json` found 0 failures.
  It lists one baseline entry that can be lowered, and it is not mine (see
  below).

## Not verified

- **No live run.** Nothing here shows DeepSeek accepting or answering these
  requests. The endpoint is a stub, which is what the brief required.
- **The real web domain's packet.** Its exact capture was not run through Core
  (Core may not import the extension). The test packet is hand-written in the
  web domain's shape and uses its declared denied keys.
- **The service entry point.** `runRuntimeSession` / `_shared/runtime.ts`
  binding was mirrored in the test, not exercised.
- **The full Core test suite** (`pnpm test`) was not run; only the runtime and
  API folders were.

## What could still stop a live request after this fix

1. **Input-token estimates differ.** The adapter estimates at 3 bytes per token
   over the message content; the harness estimates at 4 characters per token
   over the whole request. Under the 8,000-token input limit, a request between
   about 24 and 32 kB passes the harness and is refused by the adapter, now as
   `llm.provider_input_budget_exceeded`. The test requests were well below
   that.
2. **One failed call ends the whole recovery.** Any exception inside a
   grant-resolved call revokes the grant: a pre-flight refusal, a timeout, a
   network error, or a malformed reply. Every later call in that recovery,
   including the patch, then fails with "grant is unavailable", recorded as
   `llm.provider_request_failed`. Control B showed this: after the refusal at
   decision 17, the patch was never sent. This is existing fail-closed grant
   design and I did not change it.
3. **The exploration's first move is a tool call.** The adapter checks tool
   keys (`toolId, description, inputSchema, effect, repeatPolicy,
   initialObservation`) and the decision schema. The test passes with a
   domain-declared observe option; a web option carrying other fields was not
   exercised.
4. **Recent activity from an `unknown` attempt.** Any status string is
   accepted, so this is not a risk. Noted only for completeness.

## Open questions or contradictions found

- **The brief's list was incomplete.** It named seven throw sites for the code;
  there were nine. The contract check (the one that fired) and the
  credential-in-body check were missing. Both now have their own codes.
- **Earlier reports misread "gate invoked".** `llmGate.invoked: true` meant a
  provider was configured, not that a request reached DeepSeek.
- **A baseline entry can be lowered, but it is not mine.** The structure audit
  says `apps/web/src/features/automation-studio/settings/flow-settings-model.ts::values`
  can go from 22 to 21. That file is another worker's; I left
  `.structure-baseline.json` alone as the brief requires. The supervisor may
  want to run `pnpm structure:baseline`.
- **Line endings changed in three test files.** `sed -i` rewrote
  `llm/tests/evidence-loop-provider.test.ts`, `llm/tests/execution-grants.test.ts`
  and `tests/llm-deepseek-flow-bootstrap.test.ts` from CRLF to LF in the
  working tree. The index stores LF (`core.autocrlf=true`), so the committed
  content is unaffected.
- **Docs are out of date.** Architecture docs that name
  `llm.provider_configuration_invalid`, if any, now need the new codes. `docs/`
  was out of scope and was not checked.
- **The Lab.** Its reports will now show the specific codes in
  `validationCodes`. I found no Lab code that matches on the old code.
