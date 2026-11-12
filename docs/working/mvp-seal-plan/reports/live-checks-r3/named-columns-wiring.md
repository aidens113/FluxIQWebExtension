# Named columns, wired end to end (run-mwb2kkv5-1baeee11)

## Outcome

Done. All three steps are in place in the Core tree and tested, and nothing is committed.

1. The row sink knows the named columns.
2. Every replay path declares them: the answer-first round's forward run, the build loops' dry run and part runs, and the post-round test gate.
3. The dedupe no longer loses rows.

Each new test fails when its change is reverted. I checked this for every wiring point.

All paths below are in Core, under `C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ/packages/fluxiq/src`. `af` is `framework/automation-service/service/answer-first`.

## What changed and why

### Step 1: the attempt hands the instruction to the sink

- **`af/attempt/run-attempt.ts:167`.** The sink call now gets `instructionText: input.instructionText`. Without it, the sink's named-columns rule (committed earlier) never ran live.
- **New test: `af/attempt/tests/named-columns.test.ts`.**
  - It runs whole attempts through the real service with a scripted model and the fake library.
  - The read brings `title`, `due` and `link`; the request is "with columns title and due".
  - With the request, the result has exactly `title, due`. Neither the preview rows nor the judge's sample rows have `link`, and all 3 rows are kept.
  - With no columns named, all three columns stay.

### Step 2: the loops pass `namedColumns` beside `partOf`

**Inside `runtime/llm`:**

- **`loop-configuration.ts`.** New documented loop input `namedColumns`, read once by the caller with `automationStudioFlowBootstrapInstructionColumns(instructionText)`.
- **`evidence-loop.ts`.** Forwards it at :215 (the tool set: `core.run_flow` and the forward run) and at :367 (the dry-run gate). I changed those lines in place, so the file stays at 800 lines.
- **`node-tools/dry-run-gate.ts`** passes it to `replayAutomationStudioFlowDraft`.
- **`node-tools/run/flow.ts`** passes it to `runAutomationStudioFlowDraftPart`.
- **`node-tools/run/flow-part.ts`** passes it to `automationStudioFlowDraftReplaySteps`.
- **The earlier uncommitted `replay.ts`, `span.ts` and `draft.ts` change** is kept unchanged and built on.

**The loop input carries no instruction text**, so the value has to be set where each loop input is built. With the coordinator's grant (limited to the `namedColumns` property):

- **`af/attempt/round.ts`.** Sets `namedColumns: automationStudioFlowBootstrapInstructionColumns(input.instructionText)` beside `lastingActs`, and adds the function to the existing bootstrap import. This is the answer-first loop, whose forward run sent this run's read.
- **`framework/automation-service/service.ts`.** The same property, from `bootstrapInstructionText`:
  - **:1578, the candidate loop.** That loop runs with `draft:false` and `dryRun:false`, so the property is inert there; it is set for consistency.
  - **:1608, the build loop.** This is its dry run and `core.run_flow`.
  - **:1655, the direct dry-run gate.** This is the test of the Flow a stopped round left.

  `automationStudioFlowBootstrapInstructionColumns` was added to the existing import at :101. That is the only other change in service.ts, and the line count is unchanged (4304).

**Tests:**

- **Answer-first round, end to end** (`af/attempt/tests/named-columns.test.ts`, second describe).
  - The test registers a library extraction node with a `record-output` parameter and `metadata.recordsPath`.
  - The model reads by hand (fields `title`, `due`, `link`), presses the card, then runs `core.run_flow {from: 2}`.
  - The forward run sends the read again to the target. That call's `parameters.recordOutput.schema.fields` is exactly `title, due`, and the delivered columns are `title, due`.
  - With no columns named, it is `title, due, link`.
- **Loop level** (added to `node-tools/replay/tests/replay-named-columns.test.ts`).
  - `runAutomationStudioLlmEvidenceLoop` is given a seeded read and `namedColumns`.
  - Both a `core.run_flow` part run and the dry run at completion send a record output equal to the saved Flow's assembly output.
  - Given none, they send `name, price, rating, link`.

### Step 3: the dedupe key

- **Gate.** `git -C .../!FluxIQ status --short -- packages/fluxiq/src/framework/automation-service/service/answer-first/rows` printed nothing (HEAD `b04303163`) before I started this step.
- **The fix, `af/rows/row-sink.ts` (`askedColumns`).** When the sink sets `columns`, it now also declares `dedupe: { by: <every stored, non-excluded column> }`, unless the processing declared its own `dedupe` (`{by}` or `false` stand).
  - That is exactly the identity the contract used before `columns` was set.
  - The header paragraph now says why.
- **Tests, in the existing `af/rows/tests/named-columns.test.ts`:**
  - **New: two distinct listings.** Alike in name, price and rating, different links, on both the run-batch path and the model-read path. Both rows are kept in the summary and the read-back (`totalRows` 2). The stored rows stay whole.
  - **New: a declared dedupe stands.** Both `{by:["name"]}` and `false` are kept.
  - **New: a row repeated whole is still one row.**
  - **Five existing expectations updated.** They pinned the stored processing, which now also carries the dedupe.

## Commands run and observed results

Vitest ran in `packages/fluxiq`; pnpm ran at the Core root.

**Revert checks.** Each change was undone, the test was run, and the change was restored. A grep for my markers then found nothing.

- **Step 1.** Without the `run-attempt.ts` line: 1 failed / 1 passed (`expected ['title','due','link'] to deeply equal ['title','due']`). With it: 2 passed.
- **round.ts.** Without the property: the named-columns forward test failed (`expected ['title','due','link'] ... ['title','due']`); 3 passed.
- **Loop chain.** Dropping each of these in turn made the loop-level test fail (1 failed / 4 passed each time):
  - `evidence-loop.ts` :215
  - `evidence-loop.ts` :367
  - `dry-run-gate.ts`
  - `run/flow.ts`
  - `run/flow-part.ts`

  My first attempt at the two `evidence-loop.ts` drops left broken syntax ("no tests"), so I redid them as proper replacements.
- **Step 3.** With `dedupe` left as `process?.dedupe`: 6 failed / 7 passed, including `expected 1 to be 2` on the two listings. With the fix: 13 passed.

**Suites:**

- `npx vitest run af/rows af/attempt af/tests`: exit 0, 69 files and 496 tests passed.
- `npx vitest run src/runtime/llm/node-tools src/runtime/llm/tests src/runtime/llm/evidence-loop`: exit 0, 85 files and 1218 tests passed.
- `npx vitest run src/framework/automation-service/tests/service-bootstrap` (exercises the service.ts build loops): exit 0, 22 files and 121 tests passed.

**Typecheck, audit and build:**

- `pnpm --filter fluxiq check`: exit 0.
- `pnpm structure:check`: "structure-audit: passed (529 warning(s), 969 baselined).", exit 0.
  - Warnings on touched files are advisory only: `row-sink.ts` 475 lines (was 470), `evidence-loop.ts` 800, `loop-configuration.ts` 639, `dry-run-gate.ts` 567.
- `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/sdk --filter @fluxiq/ui-components build`: exit 0.
  - fluxiq and ui-components rebuilt.
  - contracts, sdk and client-gateway-websocket were reused from the cache (inputs unchanged).

## Not verified

- **No Lab, live or paid run.** Nothing confirms the chat answer or the domain's narrowing of a forward-run read live.
- **The real-SQL store path for the two listings.** It is not tested directly. By the code, the store processes with the stored batch's processing, which now carries `dedupe.by`. The `row-sink-real-store` tests passed inside the rows suite.
- **The rerun put-back (`node-tools/step-place.ts` `redo`).** It sends steps again without `partOf` or `namedColumns`, as before. It was outside the brief's chain and is not wired.
- **The `plan.over` check pass at `replay/span.ts:573`** builds its call with no definition, so it derives no record output either way. It is unchanged.
- **The extension and Lab checks** were not run.

## Open questions or contradictions found

- **In the round test, the forward run's read replaced the result list** (`answer_first.result_list_replaced`, "this read was not asked the way the list the result held was"). The replayed read now carries a derived `recordOutput` that the hand read did not have. The same happens with no columns named, because the replay already derived one from `definitionOf`, so this is not new with this change. It may still be worth a look: a forward run of the result's own read reads as a different list.
- **The candidate loop's `namedColumns` (service.ts:1578) is inert** because that loop drafts nothing. The candidate's own subflow tests go through `scoped-submission.ts` with `partOf`, which carries the part's answer columns.
- **The new test file `node-tools/replay/tests/` sits apart from the other replay tests**, which are in `node-tools/tests/`. That folder is at its file limit (25 files plus `run-part/`).
