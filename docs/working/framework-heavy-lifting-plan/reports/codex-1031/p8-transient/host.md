# t826 host producer implementation ? source frozen

Outcome: Partial (source/tests prepared; generated validation held for rebuilt Core 0.18 SDK).

## Implementation

- New host-only `domain/src/runtime/host-failure/{read,annotate,carried,attempts,index}.ts`. Strict original records win before code fallback, including unknown valid codes; explicit RATE_LIMITED and classified TRANSPORT_TRANSIENT alone gain temporary cause. Invalid/contradictory annotation retains the valid original. Browser-shared constructors/classifier/carrier are unchanged and no host helper is exported through domain/client.
- `runtime/adapter.ts` preserves original category/retryability/stage/effect/certainty/wait/comparisons before fallback, keeps existing sensitive-comparison screening and digest behavior, and drops stale failure on succeeded/cancelled status. Invalid supplied originals can retain old fallback diagnostics but cannot gain new transient metadata through fallback. `io/gateway-output-dispatcher.ts` annotates only strict valid host records; preserves invalid supplied input for the existing adapter diagnostic fallback rather than silently treating it as absent, and drops stale failure on success. Its thrown-carrier path retains a strict original.
- `runtime/lasting-act-statement.ts`: explicit original ambiguous effect now precedes stage/code-derived unacted inference. Temporary cause never determines effect.
- `llm-evidence/action-failure/execute.ts`: one typed host dispatch wrapper preserves strict attached original thrown failures; generic lost acknowledgements become unknown. Used by initial retry attempts, source-reacquired attempts, capture, actAndCapture and replay reset. It does not add browser constructor fields or change retry policy.
- `node-run/retries/dispatch.ts`: strictly reads failures, keeps complete original answer history and exposes a CONTROL-only history-vetted failure separately from the existing explanatory selected result. `answer.ts` refuses to replace a later strict ambiguous/authoritative target-coded result with an older rate limit. `reacquire.ts` records fresh target dispatches through the same wrapper and appends unknown/thrown-original outcomes to that same history.
- History gate checks preannotated inputs too: a selected temporary unacted record is eligible only when every actual answer is strictly failed/unacted/retryable and no landed/uncertain settlement exists. Earlier ambiguity/authority is projected instead; unknown/missing/malformed/success history grants no exemption. Originals and selected explanatory evidence are not mutated. A synthetic gone answer cannot erase the earlier prefix.
- `llm-evidence/capture.ts`: new optional result failure field and mirrored Core key; every new tool failure is projected by public projectAutomationStudioFailureControlRecord in toolExecution BEFORE return and raw debug serializers. No expected/actual/digest enters this field. Existing exhaustive present builder remains explicit. Failure is a separate optional seventh argument, avoiding unrelated facts-builder churn.
- `tool-rejection.ts`: optional carried failure is CONTROL-projected at construction before any throw wrapper can observe it. `tools.ts` and `harness-options/execute.ts` catches preserve only that projected field. Captured action/refusal throw paths retain current failure; malformed optional failure affects neither evidence nor existing flags.
- `node-run/run.ts` carries history-vetted controls through page refusal/catch into the central producer. `replay.ts` / `replay-answer.ts` carry current controls through step failures and reset failures, preserving all existing effectApplied/person-needed/evidence/state-digest behavior. Successful answers construct no stale failure.

Explicit lead-approved path addition: `node-run/retries/reacquire.ts` and its existing owning tests, to normalize the fresh-target dispatch catch behavior and record every fresh attempt. No broader policy change. The discovery report's original acted/effectApplied confusion is now explicitly superseded in place: failed replay already uses effectApplied:false; acted controls state digests only. No flag was flipped.

## Tests prepared

- New `runtime/host-failure/tests/failure.test.ts`: private-original preservation/no mutation, qualified temporary causes and English/retryable negatives, shared constructor non-emission, unknown code/authority, hostile accessor, all-attempt proof and preannotated rate-limit after earlier ambiguity.
- New `llm-evidence/node-run/retries/tests/transient.test.ts`: actual exploration/replay temporary failures (ordinary and carried throw) traverse real domain runtime into public Core evidence loop with no provider; CONTROL-only serialized failure; malformed optional data preserves actual flags/evidence; earlier ambiguous safe-state prefix cannot be hidden by selected rate-limit explanation; failed capture catch/current failure then success clearing; reset failures preserve original ambiguous/unacted/absent effects and existing flags.
- Extended `runtime/tests/adapter.test.ts`: original known/unknown controls, temporary ambiguity, authority, success clearing and malformed supplied auth+RATE_LIMITED record cannot earn new temporary admission via fallback.
- Extended `io/tests/gateway-output-dispatcher.test.ts`: host annotation preserves original ambiguous controls/no mutation and success removes stale failure.
- Extended `runtime/tests/lasting-act-statement.test.ts`: explicit original ambiguity beats target-resolution/dispatch/code unacted defaults.
- Extended retries `answer.test.ts`: later ambiguous/auth target-coded suffix cannot be hidden by older rate limit. Extended `reacquire.test.ts`: fresh target dispatch records original thrown ambiguity and generic unknown acknowledgement in the same history.

The actual Core tool parser is internal, so the new Down test uses public runAutomationStudioLlmEvidenceLoop rather than a nonexistent parser export or deep import. It asserts actual call accounting and no tool_result_invalid rejection after the domain produced its new field. The Core reader worker already owns exact parser field tests.

## Validation and pending checks

No tests, typechecks, generated builds, API/browser/panel calls, git operations or runtime-state/secret access performed. Root explicitly held generated Down checks until final SDK rebuild. Source inspection confirms capture.ts741 lines and run.ts792, both below800; no padding/extraction was used to hide growth. No structure baseline changed. Current source is frozen for independent lead acceptance.

Pending after rebuilt Core 0.18 release, from this task worktree:

```powershell
pnpm.cmd --filter @fluxiq-web-extension/domain check
$env:DOMAIN_TEST_BUILD_LABEL = 't826-host'
pnpm.cmd --filter @fluxiq-web-extension/domain test runtime/host-failure/tests runtime/tests/adapter runtime/tests/lasting-act-statement io/tests/gateway-output-dispatcher runtime/llm-evidence/node-run/retries/tests runtime/llm-evidence/tests/name-assumption runtime/llm-evidence/tests/tools runtime/llm-evidence/harness-options/tests
Remove-Item Env:DOMAIN_TEST_BUILD_LABEL
```

Root also owns Down structure audit and independent browser non-emission/build-boundary checks. Unverified edges: generated SDK/type compatibility, new named test runtime outcomes and any preexisting exact result assertion needing the new optional host controls. No live/browser validation is claimed or needed to prove this host-only signal contract.
