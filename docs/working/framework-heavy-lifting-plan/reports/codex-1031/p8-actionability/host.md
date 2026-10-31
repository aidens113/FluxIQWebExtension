# t827 host actionability — source frozen

Outcome: Done for source/test preparation; generated acceptance awaits lead SDK release.

## Changes

- Reused the lead's frozen `WebAutomationActionResult.actionability` field without editing its owner. The browser-facing pure reader is now named-exported through the existing `domain/client` barrel.
- Added `actions/actionability/{own-data,property,payload,copy,index}.ts`: the frozen pure Core reader is the only control validator. Optional descriptors explicitly distinguish absent/accessor/unreadable; no optional getter runs and no caught failure becomes empty absence. The local accepted-result consumer copy excludes only the reserved optional control, re-adds a strict fresh record when valid, preserves every other own descriptor, and leaves the raw gateway/result/digest/reconciliation objects untouched. Selective optional descriptor traps are inspected once and skipped while copying.
- Gateway payload projection emits only existing `payload.actionability`; browser-result gateway top-level source stays unchanged. IO lifts a separate typed post-acceptance field across actual statuses, and the runtime adapter explicitly carries that field without changing original status/failure/authority/effect handling.
- Central tool type/key list/producer strictly project the separate control before raw return/serialization. Recoverable throws, capture failure, page refusal, node exploration/replay/reset and outer authoring/harness catches retain it without putting it into opaque model evidence or page/draft metadata.
- Valid typed control wins the covered distinction in refusal and retry-answer explanation selection; only absent/invalid typed controls use the old closed prefix. Failure authority/ambiguity and all-attempt t826 retry protections remain unchanged.
- `actAndCapture`, `pressControl`, `enterWebField` now return a per-call `{page,actionability?}`. Only `page` is restamped/shown/retained. Successful action followed by a failed observation keeps the action's measured fact and never launders the observation's unacted/transient controls into a statement about that action. Existing actual person/effect flags remain unchanged.
- Checkbox restoration and the existing node `pressAgain` callback replace the surfaced measurement with their own actual fresh result, including absence. No new policy/retry/permission decision was added.
- Extracted the existing coherent `foundAt` helper unchanged into `node-run/found-at.ts` to keep the run module within its budget. No public node-run export is needed for this internal helper.

## Exact changed paths

Source:
- `domain/src/actions/actionability/{own-data.ts,property.ts,payload.ts,copy.ts,index.ts}`
- `domain/src/client/{index.ts,gateway-mapping.ts}`
- `domain/src/io/gateway-output-dispatcher.ts`
- `domain/src/runtime/adapter.ts`
- `domain/src/runtime/llm-evidence/{capture.ts,tools.ts,press.ts,enter-field.ts}`
- `domain/src/runtime/llm-evidence/action-failure/{execute.ts,refusal.ts}`
- `domain/src/runtime/llm-evidence/tool-rejection/carrier.ts`
- `domain/src/runtime/llm-evidence/node-run/{run.ts,replay.ts,replay-answer.ts,found-at.ts}`
- `domain/src/runtime/llm-evidence/node-run/retries/answer.ts`
- `domain/src/runtime/llm-evidence/harness-options/execute.ts`

Tests:
- `domain/src/actions/actionability/tests/property.test.ts`
- `domain/src/client/tests/browser-result-mapping.test.ts`
- `domain/src/io/tests/gateway-output-dispatcher.test.ts`
- `domain/src/io/tests/gateway-output-dispatcher-durable-reconcile.test.ts`
- `domain/src/runtime/tests/adapter.test.ts`
- `domain/src/runtime/llm-evidence/action-failure/tests/refusal.test.ts`
- `domain/src/runtime/llm-evidence/node-run/retries/tests/{answer.test.ts,actionability.test.ts}`
- `domain/src/runtime/llm-evidence/harness-options/tests/actionability.test.ts`

The authoritative action type, browser/shared source, browser-result mapping source, snapshot/sanitize owner, retry dispatch/reacquire bodies and host-failure helpers are untouched. No Core, versions, exports JSON, guidance, architecture, shared Current/Ledger or other report edits.

## Prepared coverage and acceptance command

Tests prepare both portable branches/all causes; common browser/host reader identity; exact payload-only wire shape and unchanged legacy top-level keys; optional getter/proxy/private-extra rejection and descriptor-preserving raw immutability; IO/runtime statuses and strict original authority; real required/durable reconciliation of the open payload without another press; typed-versus-prefix refusal/selection; actual exploration/replay/reset/capture throws through the public Core evidence loop with accounting/flags preserved; fresh success/second press/checkbox restoration clearing; successful action followed by failed observation; successful recovery press/type/select/navigation; and raw serialization privacy. No browser/provider test is included.

After rebuilt Core 0.19 SDK release, use a distinct DOMAIN_TEST_BUILD_LABEL, e.g. `t827-host`, and the existing test-domain runner with named selectors:

```powershell
pnpm.cmd --filter @fluxiq-web-extension/domain test actions/actionability/tests client/tests/gateway-mapping client/tests/browser-result-mapping io/tests/gateway-output-dispatcher runtime/tests/adapter runtime/llm-evidence/action-failure/tests/refusal runtime/llm-evidence/tool-rejection/tests runtime/llm-evidence/node-run/retries/tests runtime/llm-evidence/tests/page-refusal runtime/llm-evidence/tests/capture-after-action runtime/llm-evidence/tests/tools runtime/llm-evidence/tests/press runtime/llm-evidence/harness-options/tests
pnpm.cmd --filter @fluxiq-web-extension/domain check
```

Lead owns structure audit, source acceptance, exact old/new Core persistence/reload matrix, browser production proof and integration.

Validation: source reads/line counts/searches only. `run.ts` 792 lines, `capture.ts` 758, `tools.ts` 800; helper sources 8–23 lines. Search for prohibited new call/literal spreads in new scoped tests, stale `payload-copy` imports and actionability on snapshot/retry-dispatch/reacquire owners returned no matches. No baseline/limit changes.

Not verified: all new/existing test runtime outcomes, type compatibility with rebuilt SDK, structure audit and browser/live behavior. Generated Down tests/types/build were explicitly held by the lead and were not run. No full suite, API/model, browser/panel, git, secret or runtime-state operation was performed.

Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/p8-actionability/host.md`

Notes: Full source freeze sent to lead with exact paths. `payload-copy.ts` was fully renamed to approved `copy.ts`, with no facade or stale import. Source changes are restricted to the task worktree.
