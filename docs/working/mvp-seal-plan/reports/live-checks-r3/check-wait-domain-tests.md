# check-wait domain tests (t885)

## Outcome
Done. `runtime/llm-evidence actions` passes 1828/1828. Seven of the ten were an intended change (tests updated); three (1380, 1705 first command, 1772) were a real defect: passive readers wrongly carried the allowance, fixed in code.

## What changed and why
Code: `domain/src/runtime/llm-evidence/tools.ts`. Added `passiveGateway = sessions` (the raw gateway, no `webNodeFinalGateway` lowering). `observeResult`, `startState` and `captureSanitizedFailureEvidence` now send through it, so they carry no `checkWaitMs`. Cause: `webNodeFinalGateway` adds the allowance to every `capture_snapshot` the runtime sends, including these. They read a check page as a page, and a failed host/failure capture throws in Core's engine. `check-wait.ts` is unchanged: its rule (whole-tab looks, select, check) is the intended one and its own test already states it.

Per test:
- 854 describe_element, 858 find_on_page: intended. The trace names these captures as carrying it. Tests (`page-find/tests/description.test.ts`, `run.test.ts`) now expect `checkWaitMs: 15_000`.
- 1235 build run-node: intended. The model's own look (snapshot node) carries it. Test (`plan-resolution/tests/resolve-plan-node.test.ts`) renamed and now asserts snapshots carry it while plain `web.dom.type` does not.
- 1471, 1472, 1476, 1477 detection and target packets: intended. The trace lists detections as carrying it; the target look inside a detect call is part of the model's call (`structure/detect.ts`). Frame-addressed capture (`browserFrameId: 7`) correctly still has none, and that assertion passes unchanged. `structure/tests/detect.test.ts` updated.
- 1380 startState: NOT intended. Passive reader. Fixed in code; the test is unchanged and now passes (it asserts no allowance).
- 1705 binding: first command (passive result reader) NOT intended, fixed in code and the test's assertion unchanged. Second command (the model's ordinary look via run node) intended; `result-observation/tests/binding.test.ts` line 31 now expects `{ checkWaitMs: 15_000 }`.
- 1772 post-failure capture: NOT intended. Fixed in code; test unchanged and passes. That tests stays as the kept rule for the passive-reader exemption (together with 1380 and the 1705 first assertion).

Files changed: tools.ts; tests: page-find/tests/description.test.ts, page-find/tests/run.test.ts, plan-resolution/tests/resolve-plan-node.test.ts, structure/tests/detect.test.ts, tests/result-observation/tests/binding.test.ts (all under `domain/src/runtime/llm-evidence/`).

## Commands run and observed results
- `cd domain && DOMAIN_TEST_BUILD_LABEL=t885-int node scripts/test-domain.mjs runtime/llm-evidence actions` -> exit 0, tests 1828, pass 1828, fail 0 (first run after the code fix: 1827 pass, 1 fail = 1705's second assertion, then fixed).
- `node scripts/structure-audit.mjs` -> "passed (245 warning(s), 552 baselined)", exit 0.
- `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` in domain -> both exit 0.
- `pnpm --filter @fluxiq-web-extension/domain check` -> exit 1, NOT from types: its Core-currency gate refuses ("Core's build ... not current with its source", stale fluxiq:build and ui-components:build in `!FluxIQ`). Needs Core's libraries rebuilt; I did not touch Core.

## Not verified
- `pnpm check` gate itself (blocked by stale Core build; the tsc it wraps passes when run directly).
- No live browser or Lab run.
- The state-digest hook in tools.ts (about line 480, `captureEvidence(gateway, ...)`) still carries the allowance and already handles `needsPerson` by returning undefined; not covered by the failing tests, left as is.

## Open questions
- Is the state-digest hook capture meant to carry the allowance? It looks consistent with the design (it tolerates a person-needed check) but is not named in the brief.
