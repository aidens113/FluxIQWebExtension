# t1036-g: W1 and W2 combined (worker report)

Trees: `fxwork/t1036/!FluxIQWebExtension` (merge in progress, MERGE_HEAD b32eaa46a) and `fxwork/t1036/!FluxIQ` (merge commit 690cffed1). I ran no git that changes anything. The three conflicted files are resolved in the working tree and still show `UU` until the lead stages them.

## Outcome

**Partial, stopped on the coordinator's instruction.** I did steps 1-3 of the brief: the conflicts, the fixes and every named check. All the checks pass. I did not do step 4, the scripted Lab run, because the coordinator said to stop before it: the Lab refuses a tree that lacks dev until the lead commits the merge and merges dev in.

## Conflict resolutions (downstream, `packages/test-runner/src/attempt-lane/scripted-model/`)

1. **`wire-request.ts`.** Both sides had fixed the same defect: a judge that continues the decider was read as a chat turn. I kept W1's general reader, `payloadOf(message) ?? continuedPayload(earlier messages)`.
   - It finds the newest earlier message whose last text block is a task's JSON. That covers W2's case too: the last turn is a `system` turn of prose, and the task is the last block of the user turn before it.
   - It also skips a block that opens like an object but is not JSON, where W2's version would throw.
   - I removed W2's now-unused `continuedPayloadOf` and merged the two comments.
   - W2's `tests/wire-request.test.ts` passes on this reader, among the 138 tests below.
2. **`scripts/bigbox-retail-rated-delivery-towels.ts`.**
   - Header: `isRecord` stays (W2). `Step` is `{ step, actionId, callId?, disposition?, input? }`, which holds both sides' fields. `DETOURS` stays (W1: the framework drafts the first-visit detours, and the script drops them).
   - Read block: I took W2's single-call read. It reads the `columns` probe rows, and `read-first` uses `handle: card.handle` with fields `{name, price, rating, ad, fulfillment}`.
   - W1's detour drop and its `callId === "read-first"` lookup were outside the conflict and stay as merged.
   - The page comes from W1's `currentPageOf`, which rebuilds the page from deliveries, so the script answers native tool calls (W2's model server), single reads and page deltas.
3. **`scripts/tests/bigbox-retail-rated-delivery-towels.test.ts`.**
   - I took W2's `columns` probe fixture and its draft (whose read step holds `extraction.2`), and W2's read assertions with W1's test title.
   - W1's detour test now gives its `read-first` step an `input` holding `extraction.2`, because the script looks up the read step's extraction (`extractionOf`) before it checks for detours.

## Fixes, each with its cause

- **Core: the `asked-table-replies.test.ts` typecheck.** It was already fixed in the Core merge commit, and `pnpm --filter fluxiq check` passed before I changed anything.
- **Core: `runtime/llm/decision-handlers/withdrawn-actions.ts` deleted, with its barrel line.**
  - Its own header said it stays only until the Anthropic decision check stops importing it. After W2 nothing imports it: a grep finds only the barrel.
  - W1's open question 1 asked for this deletion.
- **Core: `answer-first/completion/tests/judge-continues-decider.test.ts` (failed in real-sql).**
  - Cause: its fake wire read `output_config.format`, which a tools request no longer sends (W2's open question 2).
  - On the coordinator's instruction I replaced it byte for byte with `fxwork/t1038/!FluxIQWebExtension/test-runs/t1038/a1-judge-continues-decider.patch-target.ts`, which is what Core dev holds. `cmp` reports it identical.
- **Domain: three tests in `rejection-next/tests/list-handle-elsewhere.test.ts` and one in `structure/tests/target-binding.test.ts` minted handles through the removed `web.find_on_page`.**
  - They now take the handle from `runtime.pageChannel.fullPage`, as `element-record.test.ts` does.
  - In target-binding, the hidden menu line is printed as `tN hidden <p> "Saved lists...`.
  - In list-handle-elsewhere, the whole page prints the label and the select it names as one line, `t2 select "Qty"`. So the select's handle stands in as "one element, not a list", and the assertions are unchanged.
- **Domain: `structure/tests/detect.test.ts` "a handle from a page the browser has left...".**
  - Under D2 the same place keeps its handle, so the test now asserts that `instead` equals the handle sent.
  - The refusal and the later detection through that handle are unchanged. Per the brief this is a changed premise, not a regression.
- **Domain: `tests/read-columns/tests/split-rows-read.test.ts:111`.** I made the coordinator's change exactly: the comment line, then the regex "of the list this read names". It matches W2's tree.
- **Domain: five carried-repair tests failed with `llm.provider_output_invalid` / `flow_bootstrap.model_replies_unreadable`** (`runtime/tests/carried-service-repair.test.ts` x4 and `carried-row-service-repair.test.ts` x1). This was not in the brief's list.
  - Cause: the two fixtures fake DeepSeek's wire and answered every decision as JSON text. Since W2 (A2), Core sends a decision to DeepSeek as function tools with `tool_choice: "required"`, so a text reply is refused.
  - W1 had fixed these tests before W2 existed, and W2 never ran `runtime/tests`. Only the combination shows the failure.
  - This is a test-side fix. The new test support `runtime/tests/deepseek-decision-reply.ts` answers with the one `tool_calls` entry the decision stands for. The name follows Core's rule: the tool id for a tool call, else the decision's kind, with each character outside `[A-Za-z0-9_-]` written as `_`. It asserts that the request offers that name. A request without tools still gets JSON text.
  - The judge replies are unchanged.

## Commands run and observed results

All heavy steps ran through `heavy-slot.mjs run t1036g --`.

**Core** (`fxwork/t1036/!FluxIQ`):

- `pnpm --filter fluxiq check` -> exit 0, before my edits and again after the test replacement.
- In `packages/fluxiq`, `NODE_OPTIONS=--max-old-space-size=3072 node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/runtime/llm src/runtime/models src/runtime/result-verification src/runtime/answer-first src/framework/automation-service/service/answer-first src/runtime/project-agents`:
  - parallel: `Test Files 815 passed (815)`, `Tests 6999 passed (6999)`;
  - real-sql: `Test Files 1 failed | 76 passed (77)`, `Tests 1 failed | 524 passed (525)`. The one failure was judge-continues-decider.
- After the replacement, real-sql on that file alone -> `Tests 1 passed (1)`, `all groups passed: real-sql`. I did not re-run the whole real-sql group.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (577 warning(s), 903 baselined).`
- `pnpm --filter fluxiq build` -> exit 0.
- The downstream gate then still called `ui-components:build` stale, so I ran the library build it names (`pnpm --filter @fluxiq/contracts --filter @fluxiq/sdk --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/ui-components build`) -> exit 0. `core-build: ... is current with its source.`

**Downstream** (`fxwork/t1036/!FluxIQWebExtension`):

- `DOMAIN_TEST_BUILD_LABEL=t1036 node scripts/test-domain.mjs llm-evidence output-nodes actions/extraction extraction runtime/tests element-fingerprint target-reacquire state-diff` -> `# tests 2557 # pass 2548 # fail 9`.
  - The nine failures: 3 in list-handle-elsewhere, 1 in split-rows-read and 5 carried-repair. The detect and target-binding tests had already been edited before this run, and both passed.
  - After the fixes, `test-domain.mjs llm-evidence/rejection-next llm-evidence/tests/read-columns runtime/tests/carried llm-evidence/structure` -> `# tests 124 # pass 124 # fail 0`, with all nine named tests `ok`. I did not repeat the full selection.
- `pnpm --filter @fluxiq-web-extension/domain check` -> exit 0.
- `pnpm --filter @fluxiq-web-extension/test-runner build` -> exit 0.
- `node --test "dist/attempt-lane/scripted-model/**/tests/*.test.js" "dist/flow-chart/tests/*.test.js"` -> `# tests 138 # pass 138 # fail 0`.
- `pnpm --filter @fluxiq-web-extension/extension test` -> `Extension smoke test passed.` and `# tests 4168 # pass 4168 # fail 0`.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (263 warning(s), 550 baselined).`
- `node scripts/check/model-text.mjs` -> `model-text: ok (203 scenario tokens, 567 model-facing Core files, 14429 string literals)`.

## Not verified

- **Step 4, the scripted bigbox Lab run (attempt 1 confirmed, attempts 2-4 with continuation proofs, each `flow.png`), was not run.** The coordinator held it until dev is merged into these trees.
- The full domain selection and the full Core real-sql group were not re-run after the last fixes. Only the files that failed were re-run.
- No browser e2e and no live or paid call.

## Open questions or contradictions found

1. **Model-facing text still says "look at the page again"**, though there is no look since D4/D11: `domain/src/runtime/llm-evidence/rejection-next/next-sentence.ts:234` (handle_not_in_packet) and `:254` (`STALE_NEXT`).
   - This is a W1 leftover that predates the merge, not a break caused by combining. So it was outside my owned scope, and I left it.
   - The fix: point the model to the newest view or to `core.full_page`. The asserting tests to update are `list-handle-elsewhere.test.ts` (the exact sentence) and `detect.test.ts` `assertStale` (`/look at the page again/`).
2. **Under D2, a stale-page refusal can name the same handle the model sent as `instead`** (the detect test above). The model is told to use a handle "instead" that it already used, and the retry succeeds, because the refusal's own page was recorded.
   - A product option: bind the handle directly when the current page prints the same handle at the same selector (`structure/detect.ts` `boundTarget`/`staleTarget`).
   - This is a lead decision. I did not change it.
3. The comment at `structure/detect.ts:76` still names `web.find_on_page` (historical; W1 noted it).
