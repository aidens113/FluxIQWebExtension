# w2-humanness / record-on-result

## Outcome
Done. Click, type and scroll results above humanness 0 carry `humanness: { level, aimed, misclick? }`; at 0 or with no level the result is the same object as before (no key).

## What changed and why
- `apps/extension/src/content/action-runtime/humanness/record-humanness.ts` (new, one export, barrel updated): `recordHumanness(result, human, aimed, misclick?)` returns the result untouched when `human` is undefined, else a copy with the record.
- `humanness/misclick/before.ts`: `misclickBefore` takes an optional 4th arg `onMisclick(point)`, called once the misclick is dispatched. Return values and existing callers unchanged.
- `actions/click.ts`: `human` is now read at the top; every return (already-in-state, gate refusal, post-misclick refusal, in-place press, link press) goes through a local `mark`. `aimed` is true only when `aimPress` produced the press point and no misclick moved the page (which re-measures and uses the gate point). Misclick point recorded via the callback.
- `actions/type.ts`, `actions/scroll.ts`: the verb is now a thin wrapper `recordHumanness(await <verb>Result(...), commandHumanness(action), false)` around the old body (renamed `typeActionResult`, `scrollActionResult`). Covers success, rejection and failure.
- `domain/src/actions/types.ts`: optional `humanness` on `WebAutomationActionResult`.
- `domain/src/client/gateway-mapping.ts`: `humannessRecordValue` (private) copies `level`, `aimed`, `misclick{x,y}` field by field into the payload, only when present and well-formed (finite number level, boolean aimed).
- Tests added: click `humanness.test.ts` (level 0 / none deep-equal and no key; level 80 level+aimed matches the point used; badge fallback records aimed false), click `misclick.test.ts` (misclick point recorded; none when unmarked or at 0), humanness `type.test.ts` and `scroll.test.ts` (aimed false, none at 0/absent), domain `gateway-mapping-humanness-record.test.ts` (copied, only named fields, omitted when absent or unreadable).

## Core end to end (read-only), the record is kept
Nothing strict refuses or drops an extra key inside the result payload:
- Extension side: `domain/src/client/browser-result-mapping.ts:31` spreads `webAutomationActionResultPayload(...)` into the gateway `payload`; `domain/src/io/gateway-output-dispatcher.ts:121` passes `result.payload` through whole as `outputs.result`.
- Core inbound: `client-gateway/service/inbound.ts:160-161` and `client-gateway/service/action-result-reading.ts:43` hand the message on whole (`input as ...`).
- The durable ledger's strict check, `client-gateway/service/command-ledger/dispatch.ts:232-233`, lists allowed TOP-LEVEL result keys (`payload` among them) and only requires `payload` to be a plain object; keys inside it are free. So a payload `humanness` is accepted.
- `framework/automation-service/io-policy.ts:53` and `:126` set `result: result.payload` on the node outputs; `engine/automation/node-execution/attempt.ts:~342-346` shows the established pattern of reading named fields from `answer.outputs.result`.
- Step files: `runtime/llm/step-log/tool-step.ts` writes `result.json` as the evidence the loop returns. In this repo's evidence path, `domain/src/runtime/llm-evidence/node-run/page-record.ts:46` is a denylist (`snapshot, element, visualTarget, resolution, structure`), so `humanness` is kept; `read-result.ts:36` / `denied-keys.ts:26-35` deny only html/cookies/headers/selector-type keys, none of `humanness`, `level`, `aimed`, `misclick`, `x`, `y`.
- Consequence to be aware of: the same denylist means the model also sees `humanness` in a press's evidence. If that is unwanted, add `humanness` to `PAGE_RECORD_KEYS` (page-record.ts:46), but then it is dropped from result.json too. Not changed (outside owned files).
- Not checked: the extension's background/runtime path between the content script and `browser-result-mapping` (not my files); `protocol.ts` result type picks up the field automatically via `WebAutomationActionResult`.

## Commands run and observed results
- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t898-rec node scripts/test-extension.mjs content/actions/tests content/action-runtime/humanness` -> `# tests 277 pass 277 fail 0`.
- Re-run narrower (`content/actions/tests/humanness content/actions/tests/click`) -> 94 pass, 0 fail; the five new tests listed as ok.
- `cd domain && DOMAIN_TEST_BUILD_LABEL=t898-rec node scripts/test-domain.mjs client/tests/gateway-mapping` -> `# tests 51 pass 51 fail 0` (includes the 3 new).
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (245 warning(s), 552 baselined)`.

## Not verified
Package typechecks (left to supervisor); a live run's actual step file; the background/runtime hop. Python edits converted touched files from CRLF to LF in the working copy (git warns; diff is line-scoped).

## Open questions
Whether the model should see `humanness` in evidence (see above).
