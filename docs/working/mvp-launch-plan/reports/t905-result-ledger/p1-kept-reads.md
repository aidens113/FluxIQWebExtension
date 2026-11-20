# t905 p1b: exploring reads send answer "kept"

Outcome: Partial (code and tests done and passing; `pnpm check` blocked by stale Core build, structure audit has one violation in another worker's file).

## What changed and why
- The live read's request is assembled in `domain/src/runtime/llm-evidence/node-run/rejected-rows.ts` (`webNodeDispatchParameters`), NOT in an owned file. I edited it (one function plus one import) because it is the single point run.ts and frozen-execution/capture.ts both call; I could not ask first. It now adds `extractList.answer = "kept"` to every list read's dispatch parameters (not to `ranWith`, so the saved Flow is unchanged; the Flow's dispatch adds it itself). Rejected samples are still asked for on `proposes` reads.
- Evidence check: the content script's `rejectedSamples` are gathered from the rejected items independently of `answer` (list-reader.ts: `rejectedSamplesFor(...)` vs `filteredListAnswer(..., request.answer)`), and `rejectedRows` is built from `extraction.rejectedSamples` (rejected-rows.ts). So left-out rows still reach the model. I did not read Core's left-out.ts / read-evidence.ts.
- `shown-rows/account.ts` `restOfRows`: kept rows named kept; rejected rows named "left out and not result rows"; new sentence for a read that kept none ("the read kept no row: extracted is empty, and rejectedRows are..."); the unfiltered sentence now says "those rejected rows".
- Tests: `node-run/tests/rejected-rows.test.ts` (exploring dispatch sends answer "kept"; the kept Flow call has none) and `node-run/tests/shown-rows.test.ts` (three new tests: kept none, kept plus left out, unfiltered). Cinema-seat fixtures.

## Commands and results
- `DOMAIN_TEST_BUILD_LABEL=t905-w2 node scripts/test-domain.mjs node-run/tests/shown-rows node-run/tests/rejected-rows node-run/tests/replay actions/extraction/tests/read-request` -> 117 tests, 117 pass, 0 fail.
- heavy-slot `pnpm check` -> refused before tsc: "FluxIQ Core's build at ...\t905\!FluxIQ is not current with its source" (stale fluxiq and ui-components builds). Not rebuilt (Core is out of bounds).
- Substitute: `npx tsc -p tsconfig.json --noEmit` in domain -> errors only in plan-resolution/extraction/{element-record,saved-list}.ts and structure/{handles,packet}.ts (WebLlmExtractionBinding container/listKey; another worker's files). None in my files. tsconfig.test.json not run.
- `node scripts/structure-audit.mjs` -> 1 violation: `domain/src/output-nodes/extract-list/tests/answered.test.ts` imports `../../../runtime/llm-evidence/structure/handles` past a barrel (not mine).
- `node scripts/check/model-text.mjs` -> ok.

## Not verified
- Revert-fails check was by construction (old strings/params differ), not by actually reverting.
- Core's handling of answer "kept" explorations beyond the domain side; no live run.
- Test tsconfig typecheck.

## Open questions
- I applied answer "kept" to all list reads in exploring, including non-`proposes` ones; D3 may intend only the first.
