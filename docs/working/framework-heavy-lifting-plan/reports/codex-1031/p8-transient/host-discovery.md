# CC8 host producer discovery (t826, read only)

Outcome: Done (planning only). No implementation or generated SDK/test execution. Source paths below are relative to this t826 downstream worktree unless marked Core.

## Required boundary and non-emission proof

Do not add transient production to shared `runtime/failure/{codes,carrier,classify}.ts` or its barrel. They are browser reachable:

- `domain/src/client/index.ts` exports `../runtime/failure` wholesale.
- `apps/extension/src/content/action-runtime/results.ts:44` imports the classifier/constructor through that client surface and calls them at 158, 216, 344, 375 and other result exits. Its rate-limit result uses the shared constructor directly.
- Extension runtime action-results, action-runner and click-landing also import those shared functions from domain/client; domain/client/gateway-mapping imports the same constructor.

Therefore adding transient to the shared RATE_LIMITED or TRANSPORT_TRANSIENT rows would newly emit it on browser wire, contrary to scope. A new narrow host-only helper must live outside that shared barrel (for example `domain/src/runtime/host-failure/{read,annotate,index}.ts`), imported only by host adapter, host output dispatcher and host llm-evidence producers. Shared code/carrier/classifier may be tested for non-emission but should not gain this flag. No browser protocol/schema/source change is needed.

First host annotation is limited to already-parsed explicit RATE_LIMITED and classified TRANSPORT_TRANSIENT records. The latter is already a closed code (`web.transport.transient`), not a timeout/body-text guess. Do not turn generic retryable, any wait, NO_EFFECT, REFUSED_BY_PAGE, hidden/disabled/covered, or ACTION_FAILED text into temporary facts. Cancellation/policy/auth/person-needed/invalid-graph records remain authoritative, even if a misleading known code is present. A transient annotation never sets unacted, retries, certainty or stage.

## Original-record precedence before code fallback

Current erasers:

1. `runtime/adapter.ts:260` clientReportedFailure rebuilds even a valid original by closed code, retaining only screened comparisons, digest and retryAfterMs. This loses category/retryable/stage/effect/certainNoEffect/transient. A valid ambiguous RATE_LIMITED becomes the row's unacted; an authoritative nonretryable original can become retryable. commandFailure then classifies that weaker reconstruction at 205 and applies lasting-act statement at 223.
2. `runtime/failure/carrier.ts:78` carriedWebAutomationFailure similarly rebuilds by code, retaining only expected/actual/digest, even dropping retryAfterMs. It is browser shared, so it is not a host-only annotation site.
3. `runtime/failure/classify.ts` preserves typed outcome.failure unchanged but its thrown path goes through that shared carrier. Prefer a host strict read of an original carried failure before invoking this fallback, rather than changing browser emission behavior.
4. `runtime/lasting-act-statement.ts` currently treats target_resolution/dispatch stage as unacted even if a supplied original explicitly says ambiguous. A valid explicit producer effect must outrank stage/code-derived inference. Only absent effect may use existing pre-dispatch inference; never use transient as that inference.
5. `io/gateway-output-dispatcher.ts:51` already has the browser/gateway-parsed original (or actual interruption record), and currently copies failure intact at 110. It is an appropriate host annotation boundary. A succeeded result must omit failure rather than annotate a stale reported record. The adapter must not subsequently undo this preservation.
6. `llm-evidence/node-run/retries/dispatch.ts:151` reads failure only with loose category/code/retryable checks, then casts. Its local lasting-act statement is used for Core retries, while the result returned to authoring still holds the original raw failure. A strict host helper should normalize/annotate that returned failure without changing status or the producer's control facts. The generic thrown-ack conversion remains unknown and is not automatically transient.
7. `node-run/retries/answer.ts` intentionally selects an earlier RATE_LIMITED answer when every later answer is target-gone. Preserve the complete selected original record; do not reconstruct a temporary unacted record from its code. Include a later ambiguous/authoritative-record regression so code-only fallback cannot lower the strongest observed failure.

Proposed precedence: strict original generic AutomationStudioFailureRecord first; preserve category/code/retryable/stage/effect/retryAfterMs/certainNoEffect/transient and safe comparisons. Apply existing sensitive-comparison screening separately; add digest only when absent. Host annotation adds only transient:true when its explicit code/classification qualifies and the resulting contract remains valid. If an annotation is contradictory, keep the original without annotation. Only absent/unparseable original falls back to existing domain code constructor/classifier. Do not coerce malformed fields or replace a valid unknown-code original with a weaker known-code row. Host return types may need widening from WebAutomationFailureRecord (closed code) to Core's generic record to preserve valid original code; that is a deliberate host type change, not new browser vocabulary.

Malformed optional tool failure should be dropped alone by the frozen projector; its evidence/effectApplied result remains. A parsed original's comparisons stay private/diagnostic as today, subject to the existing redaction guard.

## Producer projection before raw serializers

The frozen `projectAutomationStudioFailureControlRecord(unknown)` must be applied BEFORE the host tool result leaves its producer. The Core reader applying it later is necessary but insufficient:

- Core `runtime/llm/evidence-progress/progress-trace.ts` wraps executeTool, passes the raw return into `dump.tool({request,result})`, then returns it to the evidence loop.
- `decision-dump.ts` tool records retain that raw result.
- The same wrapper invokes `step-log` tool wrapping first; `step-log/tool-step.ts` inspects/writes result/evidence before parser-based invalid-result summaries. Its normal result.json uses evidence, but raw return still reaches the wrapper; malformed result paths can fall back to the raw value.

Never attach a full comparison-bearing failure to the new tool-result field, even briefly before this boundary. `capture.ts:386` toolExecution/readable is the central safe production gate: add the optional typed result field and named present-builder entry, projecting the internal source immediately with the frozen Core helper. Also widen mirrored `WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS` at 382 only after Core interface acceptance. Its readable loop at 492 filters outer keys, not nested failure descriptions, so it is not a substitute for the projection.

Required result failure is CONTROL only: category/code/retryable and present stage/effect/retryAfterMs/certainNoEffect/transient. No expected, actual, evidenceDigest or other description. Do not put this new record into evidence/draft/diagnostic/model prose. Full safe comparison facts remain internal to host diagnostics; copy/project rather than mutate originals. New successful results carry no old failure.

## Exact host field-loss paths to implement after release

- `capture.ts` public WebLlmEvidenceToolExecution + toolExecution/present + mirrored key list. Add a single safe attachment/projector helper if this avoids broad mandatory-facts churn; every attachment must project before return. Existing mandatory facts/result builders must remain exhaustive.
- `node-run/run.ts` WebNodeCallRecord can retain the current command's original failure privately before throwing pageRefusal. The catch/refusal builder at 617 currently forwards resultReason/nodeId/assumed only. Project selected failure at the final toolExecution boundary. Never reuse a prior call failure after a landed/succeeded result.
- `node-run/replay.ts:388` WebNodeReplayFacts loses the original failure; `replay-answer.ts:99,123,194,196` rebuilds facts through answer/answerOnPage/failedOnPage. Add the new field/attachment consistently across these named reconstructions and all nonfailure literals, preserving all existing evidence and acted flags.
- `capture.ts:543` failed capture currently throws needs_person or recoverable(page_unreadable) without preserving structured failure. `actAndCapture:698` forwards a refusal which `pageRefusal:720` converts to RecoverableToolRejection with only code/detail/page/personNeeded. If capturing temporary failures is within first emission scope, add a sanitized CONTROL-only carrier through these paths.
- `tool-rejection.ts:586` RecoverableToolRejection currently has no failure field. Prefer CONTROL-only optional failure on this potentially thrown object; do not expose full private comparisons to Core's raw throw/log path.
- `action-failure/{result,refusal}.ts`: result currently exposes only unknown code/actual, and WebActionRefusal carries only code/detail/personNeeded. Strictly read raw failure for control projection without changing existing prose/refusal/evidence behavior.
- `tools.ts:581` and `harness-options/execute.ts:123` catch RecoverableToolRejection and build new toolExecution values. Both must retain the CONTROL-only record if the carrier is extended. `node-run/verify.ts` and `missing-target.ts` construct the shared replay facts and must explicitly carry undefined where no failure exists if the mandatory-facts type changes.
- `node-run/retries/uncertain-outcome.ts` uses a spread to preserve WebActionRefusal while changing only detail; retain new failure control facts there too.

Minimal proposed ownership: host helper directory; runtime adapter + lasting-act statement; io/gateway-output-dispatcher; llm-evidence capture/tool-rejection/action-failure; node-run run/replay/replay-answer/verify/missing-target/retries dispatch+answer only where original metadata is lost; tools/harness-options catch projections. Do not edit shared failure constructors to produce new fields. Source budgets/structural checks are lead implementation concerns; no checks run here.

## Replay flags (corrected; original concern superseded)

`failedOnPage` passes acted:true to the page-answer helper, but that helper already calls toolExecution with effectApplied:false (`replay-answer.ts:194,196`). The acted argument controls before/after digests only (`replayStates:476`). Preserve those existing flags exactly. The initial discovery incorrectly inferred that acted set effectApplied; the appended follow-up records the correction and history investigation. No field flip is needed or authorized. Positive unacted admission still requires the whole requested-attempt history, because effectApplied:false is not physical proof that an uncertain failed act did nothing.

## Precise tests after interface/build release

1. New host-helper tests: valid original ambiguous rate-limit remains ambiguous; nonretryable/policy/auth/person-needed original outranks code row; unknown valid code preserved; retryAfterMs/certainty/full comparisons retained privately; only qualified RATE_LIMITED/TRANSPORT_TRANSIENT annotated; generic retryable/disabled/cover/no-effect/waits not; transient never implies unacted; constructor/browser non-emission.
2. `runtime/tests/adapter.test.ts` and `io/tests/gateway-output-dispatcher.test.ts` (or focused colocated files): original controls and sensitive-comparison redaction preserved, success drops stale failure, actual interrupted status/effect unchanged, known temporary record host-annotated only.
3. `llm-evidence/tests/name-assumption.test.ts`: exact-key parity includes failure, CONTROL-only field accepted by frozen Core parser; malformed optional failure drops alone, evidence/effectApplied stay exactly as produced.
4. `node-run/retries/tests/{answer,uncertain-outcome,lasting-act}.test.ts`: rate-limit followed by disappearing target keeps original record; later ambiguous/authoritative failure not lowered; transient committing unknown does not redispatch; actual unacted retains ordinary retries; no change to retry policy.
5. Focused host tool tests for both exploration and replay: whole result JSON BEFORE Core parse contains no comparison/digest sentinel in new failure field; private original remains intact; roundtrip field retained; landed success clears failure; malformed control field preserves existing evidence/effectApplied/personNeeded.
6. If carrier extended, `llm-evidence/tests/tools.test.ts` and harness-options owning tests prove capture/actAndCapture/catch hops preserve only CONTROL projection and no original comparison-bearing throw escapes the new field. Assert replay effectApplied:false and its digest-only acted semantics explicitly.

Validation: read-only source inspection only. No tests/checks/types/builds/generated tests, APIs/browser/panel/git, agents, secrets or runtime state used. Only this task-owned report was written. Remaining uncertainty: final verified Core exported compiled interface is not yet released; lead confirms unchanged effectApplied replay semantics and exact implementation scope after reader acceptance.

## Follow-up: one replay call, history and effectApplied (read only)

### Correction to the earlier semantic warning

The earlier section overstated `acted:true`: `webNodeReplayAnswerOnPage` (`replay-answer.ts:194,196`) ALWAYS passes false into toolExecution for failed page answers. Its `acted` argument is passed only to `replayStates` (`476`), which controls whether a before-state digest is recorded. It does not set effectApplied. `failedOnPage` therefore already returns effectApplied:false today, including uncertain failures. No emitter work should flip or reinterpret that flag. This correction supersedes the earlier 'effectApplied:true' warning; parent was notified immediately on finding the actual call chain.

The flags are distinct: an ordinary successful replay uses `webNodeReplayAnswer` (`122`) with acted=true and effectApplied=true. A failed answer on a page uses effectApplied=false as the existing unconfirmed-success result, not proof that nothing physically happened. Core's repeat exemption must also require positive failure evidence; the existing false flag alone is insufficient.

### Scope of a single step call

`replayWebOutputNode` (`replay.ts:252`) chooses exactly one of reset, verify, step. A step does not perform the reset internally and does not replay earlier Flow nodes internally. Earlier Flow steps are separate tool calls, so their lasting acts cannot be attributed to this call's effectApplied flag. A reset has its own navigation side effects and must remain separately classified.

For replayStep: permission (`webActionPermission`) checks/records a declaration and makes no gateway action; parameter resolution runs against stores (`resolve-plan-node.ts:434`) with gatedByCaller=true and no executeAction call. The before/after/refusal page paths invoke capture_snapshot only (`replay-answer.ts:157`, `capture.ts:543`). `webNodeLookUntilPresent` (`retries/look.ts`) retries those observations and does not dispatch the step while observing.

The only requested step actions are the attempts inside one `webNodeDispatchWithRetries` call (`replay.ts:373`), including a fresh-target attempt if reacquire occurs. The provided effect check (`retries/effect-check.ts`) dispatches only web.dom.assert through the expectation evaluator (`runtime/expectation/evaluate.ts:71`). It can judge landed/not_landed/unknown but does not execute a substitute lasting action.

Replay row reacquisition (`replay-row-reacquire.ts`) re-runs a remembered source read, matches identity and then refreshes the same requested command. Production memories are populated ONLY for extract_list (`replay.ts:454,455`), so that source callback is observational under the canonical read contract. It does not execute a preceding click from the Flow. A source reread itself may paginate/scroll under that read contract; this is not evidence that the requested step was unacted. Permission, resolution, capture and this row-source observation must not be counted as a successful requested lasting act.

### What Core's retry history proves, and what it does not

Core `outside-graph/retries.ts:162` returns immediately on reading.ok (success), so it cannot dispatch a later requested action after a successful result. A lasting check settled landed also returns immediately with lastingAct:landed; unknown returns lastingAct:uncertain immediately. Therefore an earlier acknowledged success, landed settlement or unresolved committing act cannot ordinarily be followed by a new requested attempt in the same successful retry invocation.

However, a selected final original unacted failure is NOT whole-call proof:

1. An ambiguous committing attempt can be followed by another attempt when its expected-state check positively says not_landed. The Core assessment is then transformed to unacted for retry, but the raw answer stored in downstream `answers` remains ambiguous. If a later attempt is RATE_LIMITED/unacted, the output has no public history of that earlier raw ambiguity or settlement. No uncertain lasting act remains according to the Core check, but a conservative new producer should not invent stronger raw producer evidence than it actually retained.
2. Trusted repeat-safe state setters can retry an ambiguous failure without any effect check; the earlier action may have physically set state. A later unacted failure says nothing about that earlier attempt. Model declarations also matter; positive lasting classes veto trusted repeat safety.
3. A fresh-target dispatch (`reacquire.ts:46`) pushes answers to the same array. If that dispatch throws, it currently does not use the original dispatch's catch-to-unknown conversion; the retry promise rejects. Any future conversion must record unknown in the history and may not manufacture unacted.
4. Reacquire gone produces a synthetic unacted target-gone result and pushes it into answers without dispatching another requested action. It proves only that final acquisition found no item, not that all preceding attempts were unacted. Its presence cannot certify the whole call or be counted as an extra physical dispatch.

`webNodeRetriedAnswer` (`answer.ts:37`) checks only a BACKWARD SUFFIX: last success is preserved; otherwise target-gone/not-shown/not-actionable answers are skipped until the latest RATE_LIMITED answer, then it returns that earlier refusal WITHOUT inspecting the prefix. Consequently `[earlier ambiguous action_failed, RATE_LIMITED unacted, target_gone]` can select an unacted rate-limit record and hide the first attempt. This is reachable for a safe-state setter; it is also reachable for a commit after a not_landed check. Current suffix checks read code and a covered: prefix, not strict original category/effect/authority, so a target-named code with valid ambiguous or policy fields is another preservation hazard. The chosen raw result/evidence may remain appropriate for user explanation, but it cannot supply whole-call unacted admission on its own.

### Conservative admission condition and minimal implementation recommendation

Preserve existing effectApplied/evidence values exactly. A new transient-unacted CONTROL projection may be used for same-call repeat admission only if:

- selected result is a failure with a strict original failure.effect=unacted, qualified temporary cause and no authoritative category/personNeeded/cancellation;
- every actual requested dispatch attempt in this invocation is a non-success with a strict original failure.effect=unacted (not a code-derived stage inference), and none is unknown, malformed, missing, ambiguous or acknowledged applied;
- there is no lastingAct landed/uncertain result, no earlier acknowledged success, and no unrecorded dispatch/throw; source reacquire/observational calls are distinguished from the actual requested dispatch history;
- selection/reacquire-generated answers do not replace or erase an original stronger failure, and helper fallbacks never lower authority/effect certainty.

For now, conservatively decline this new exemption when ANY earlier raw action failure was ambiguous, even if an effect check later permitted a retry. Broadening that case would require explicitly retaining the trusted per-attempt not_landed settlement rather than assuming it from the final answer. Do not change Core's current automatic retry policy or existing tests to impose this conservative authoring admission on runtime retries.

The natural host place is inside `webNodeDispatchWithRetries`, where the complete `answers` array and outcome.lastingAct are both available BEFORE suffix answer selection. Keep a private history/veto for new CONTROL metadata; do not reconstruct an unacted control signal just from the selected RATE_LIMITED code. If unsafe history exists, preserve its strongest earlier ambiguity/authoritative control record or omit the optional new failure signal for admission; leave selected evidence/status and existing effectApplied unchanged. Do not erase private original comparisons. No new browser field or frozen Core contract field is needed merely to enforce this conservative host emission rule.

### Specific additional tests (recommendation only)

- All real requested attempts strict RATE_LIMITED/unacted, then exhaustion: failure control can stay transient+unacted; exact preexisting effectApplied/evidence are unchanged. Include both exploration and replay.
- RATE_LIMITED/unacted then ordinary target-gone suffix: selected explanation retains the rate-limit record; whole-call admission only if ALL preceding requested attempts also carry strict original unacted proof.
- Safe-state raw ambiguous attempt -> RATE_LIMITED/unacted -> target-gone: selected evidence may remain the rate-limit explanation, but new CONTROL metadata cannot present whole-call unacted/transient admission. Assert every original control fact stays available privately.
- Commit ambiguous -> effect-check not_landed -> RATE_LIMITED/unacted: automatic retry behavior remains allowed, while conservative authoring exemption is withheld until retained settlement support exists.
- Commit ambiguous -> effect-check unknown: exactly one dispatch, unchanged existing failed replay effectApplied=false and evidence, no transient-unacted exemption. Landed check: no later dispatch, successful replay effectApplied=true and no stale failure.
- Earlier acknowledged success followed by a supplied extra answer: prove the extra answer is never dispatched. Distinguish provider answers configured by a unit fixture from answers actually consumed.
- Reacquire source read + fresh requested command: source read is observational, all actual requested answers counted; uncertain fresh dispatch vetoes new unacted admission. Reacquire gone cannot erase prior ambiguity or count as requested action proof.
- Later strict original ambiguous/policy/auth record with target-gone code must not be replaced by older code-default unacted rate-limit control metadata.
- Pre-dispatch permission/parameter refusal performs zero requested actions; after-page capture failure never rewrites selected action failure/effect or reuses a prior call's transient record.

No code/tests/checks/build/git/shared memory edits performed in this follow-up. Only this report appendix was written. The condition is deliberately conservative and may withhold an exemption on a retry the existing runtime correctly proved not_landed; it does not authorize an act or change runtime retry semantics.
