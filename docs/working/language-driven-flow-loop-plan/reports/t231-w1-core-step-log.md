# t231-w1: Core step log

Worker report. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t228/!FluxIQ`, branch `task/t228-step-logs`. Nothing committed.
`RT` = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

**Done.**
- The env-gated step log is in place: `FLUXIQ_LLM_STEP_LOG_DIR` must be an absolute directory. When it is unset or relative, every hook returns at once and nothing is written.
- It is hooked into both DeepSeek fetch sites, the evidence loop's tool wrapper, the service's phase-2 test `executeTool`, and the build phases' round/phase scope.
- All six proof tests pass, plus extra cases.
- The fluxiq typecheck is clean and Core's structure audit passes.
- One brief assertion could not be met as written ("authorization"; see Open questions).

## What changed and why

### New module `RT/llm/step-log/`

It has a barrel, one export or one cohesive group per file, and 16 files.

| File | What it does |
| --- | --- |
| `directory.ts` | `automationStudioLlmStepLogDirectory(env)`: the absolute directory, or undefined. |
| `scope.ts` | `automationStudioLlmStepLogScope.run(context, fn, env)` and `.current()`, using AsyncLocalStorage. `run` calls `fn` directly when the log is off. |
| `folder.ts` | `automationStudioLlmStepLogOpenFolder(dir, kind)` makes `NNNN-<kind>`. See "Folder numbering" below. |
| `files.ts` | The per-step writer. Every text is screened, bytes are written unchanged unless something is redacted, and every write is best-effort. `meta()` is written last and adds `redacted: true` when anything in the folder was screened. |
| `listing.ts` | `index.md`. See "index.md" below. |
| `naming.ts` | Model kinds (`decide`/`judge`/`diagnose`/`repair`/`bootstrap`, else the task kind in kebab case), the toolId folder segment (`[A-Za-z0-9._-]`, everything else including `:` becomes `_`), and the phase of a kind when no scope is set. |
| `readable.ts` | Shared renderer for `request.txt` and `response.txt`. |
| `request-text.ts` | Renders `request.txt`. |
| `response-text.ts` | Renders `response.txt`. |
| `page-text.ts` | Finds the first string `page` field within depth 4, breadth first. |
| `summary.ts` | The index summary: at most 100 chars, one line. |
| `attempts.ts` | Per-requestId exchange counter, bounded to 4096 ids. |
| `model-step.ts` | `automationStudioLlmStepLogModelStep(call, env)` returns `{ reply(raw, status), succeeded(response, usage), failed(error) }`, or undefined. |
| `tool-step.ts` | `automationStudioLlmStepLogTool(run, env)` returns a wrapper, or `run` itself when the log is off. |

**Folder numbering** (`folder.ts`):
- Numbering continues from the highest `NNNN-` already in the directory, combined with a per-process last-given number.
- Folders are made with non-recursive `mkdir`, and the number is bumped on `EEXIST`.
- `automationStudioLlmStepLogFolderRefused(error)` names the one failure that means "no step": an errno-style `code`. The "no number left" error carries `ESTEPLOGFULL`.

**index.md** (`listing.ts`):
- Rows are seeded once per process from the existing folders' `meta.json`.
- Each row reads `| NNNN | kind | tool | summary | $cost |`, sorted by step number.
- The file is rewritten on each step's completion, to a temp file renamed over it, or written directly if the rename fails.
- `meta.json` now carries a `summary` field so the seeding can rebuild rows.

**Readable rendering** (`readable.ts`, `request-text.ts`, `response-text.ts`):
- Keys and list items go one per line. Multi-line strings become indented blocks under `|`.
- `request.txt` shows:
  1. `POST <url>` and the model.
  2. "limits and settings" (`max_tokens`, `temperature`, `thinking`, `stream` and so on).
  3. Each message as `==== n role (chars chars) ====`. JSON-string content is rendered readable.
  4. `tools` and `response_format`.
- `response.txt` shows the HTTP status, finish reason, content (readable when it is JSON), `reasoning_content` if present, other message fields, and usage.
- A body that is not JSON is shown raw.
- I checked the actual rendering with a throwaway dump test, now deleted. A page view under `value.page.page` reads as the page, line by line.

**Model meta fields:** step, kind, startedAt, finishedAt, ms, provider, model, url, requestId, attempt, taskKind, stage, iteration, round, phase, status, httpStatus, usage {inputTokens, outputTokens, cacheHitInputTokens, cacheMissInputTokens}, costUsd, finishReason, error {code}, summary, redacted.
- `usage` comes from Core's parsed usage. If there is none, it comes from the error's reply account usage, then from the raw envelope.
- `costUsd` is the parsed `estimatedCostUsd`, or `price(usage)`.

**`decision.json`:**
- On success it is `{ response, usage }`.
- On failure it is `{ error: { code, name, status, retryable, reply } }`, where `reply` is the content-free reply account carrying `case`. It never holds the message.

**Tool steps:**
- `call.json` holds `{callId, toolId, input: request.value}`.
- `result.json` holds exactly `execution.evidence` when the result has `kind === "llm_evidence_tool_execution"`. Otherwise it holds the raw value, or `{error:{name,code}}` when the tool threw (the throw is rethrown).
- `page.txt` is written when the evidence holds a page view.
- Meta fields: step, kind, callId, toolId, startedAt, finishedAt, ms, round, phase, status, resultCode, resultReason, effectApplied, summary.
- The folder is `test-<toolId>` when the scope's phase is `test` or the callId starts with `dryrun.`, and `tool-<toolId>` otherwise.

**Phase outside a scope:**

| Kind | Phase |
| --- | --- |
| decide, tool | explore |
| test | test |
| judge | judge |
| diagnose, repair | repair |
| bootstrap | bootstrap |
| chat | chat |
| any other | the kind itself |

### Edits to owned files

**`RT/llm/deepseek/provider.ts`** (`runDeepSeekTask`):
- The step opens after the secret is resolved and checked, just before `fetch`. It receives the body, url, model, taskKind, requestId, `context.stage` and `context.evidenceLoop.iteration`, never the secret or headers.
- On the 2xx JSON path, the bytes already read are passed to `step.reply`.
- When the step log is on and the reply is non-2xx or not JSON, the body is first read from `response.clone()` with the same bounded reader, in the new best-effort `stepLogReply`. This happens before the refusal reader consumes the original.
- On success, the parsed result goes to `step.succeeded`.
- The catch now builds the same failure the old code threw, in the same order (provider error, then timeout, then parent abort, then network), calls `step.failed(failure)`, and throws it.
- With the step log off, the `!response.ok || content-type` check is never evaluated, because of short-circuit on `step`.

**`RT/llm/deepseek/panel-command.ts`:**
- The step (`kind: "chat"`, taskKind `panel_command`) opens after the key checks, around `send`, the bounded read and the parse.
- The raw bytes are always recorded, 2xx or not, since this adapter already reads them all.
- `price` is `estimateAutomationStudioDeepSeekCostUsd`.

**`RT/llm/evidence-progress/progress-trace.ts`:**
- The step log is a third switch for the wrapper.
- `executeTool` now runs through `automationStudioLlmStepLogTool`, which covers in-loop dry-run replays (callId `dryrun.*`).
- Unchanged: `decision-dump.ts`, the trace output, and the "same input when off" contract (its existing test still passes with `{}`).

**`RT/flow-bootstrap/unfinished-build/phases.ts`:**
- `input.round(...)` runs inside the scope `{round, phase}`. The phase is `"explore"` when round is 0 or there is no repair seed, and `"repair"` otherwise.
- The test passed to the judgement runs `input.test(steps)` inside `{round, phase: "test"}`.

**`RT/service.ts`:**
- The import was added to the existing line 91.
- The `test:` line now passes `executeTool: automationStudioLlmStepLogTool(executeTool)`.
- The line count is unchanged at 4491.

**`RT/llm/index.ts`:** `export * from "./step-log/index.ts";` with a comment.

**Tests:**
- `step-log/tests/model-step.test.ts`, 9 tests.
- `step-log/tests/tool-step.test.ts`, 5 tests.
- One new test in `flow-bootstrap/unfinished-build/tests/phases.test.ts`: the scope reads `{0, explore}`, then `{0, test}`, then `{1, repair}`, and is undefined afterwards.

## Commands run and observed results

1. `npx vitest run src/programs/automation-studio/runtime/llm/step-log` (in `packages/fluxiq`), final run: **2 files passed, 13 tests passed**. The blocked-directory test was added afterwards and passes in run 2, where `model-step.test.ts` shows 9 tests.
2. `npx vitest run <step-log> <llm/deepseek> <llm/evidence-progress> <flow-bootstrap/unfinished-build> llm/tests/deepseek-evidence-preflight.test.ts llm/tests/deepseek-json-content.test.ts llm/tests/context-window.test.ts <llm/harness/tests> <llm/build-purse/tests>`: **Test Files 33 passed (33), Tests 231 passed (231)**.
3. `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t231 w1 fluxiq tsc" npx tsc --noEmit -p tsconfig.json` (in `packages/fluxiq`):
   - First run: 2 errors in `request-text.ts:30` ("Property 'role' does not exist on type ... { content: any; }"). Fixed.
   - Final run: **exit 0, no output**.
4. `bash .../heavy.sh "t231 w1 structure audit" node scripts/structure-audit.mjs` (Core root):
   - First run: 2 FAILs `[failure-as-empty]` in `model-step.ts:65` and `tool-step.ts:53`, the folder-open `catch { return undefined }`. Fixed by naming the errno failure and rethrowing anything else.
   - Final run: **"structure-audit: passed (211 warning(s), 349 baselined)"**, exit 0.
   - The audit also says "1 baseline entries can be lowered". `--json` shows that entry is `apps/web/src/features/programs/live-views/shared.tsx::values` (24 -> 23). That is not in this work, and I did not touch the baseline.
5. `bash .../heavy.sh "t231 w1 service-bootstrap tests" npx vitest run src/programs/automation-studio/runtime/tests/service-bootstrap`:
   - **20 passed, 1 failed file; 106 passed, 2 failed**. The failures were `adaptation.test.ts` "bridges a generated proposal ID ..." (15680 ms) and "compensates back to the applied topology ..." (15086 ms), both timeouts.
   - Re-run alone (`... service-bootstrap/tests/adaptation.test.ts`): **9 passed (9)**, at 2274 ms and 2167 ms.
   - So these are timeouts under parallel load. With the step log off, the changed code on this path is `automationStudioLlmStepLogTool` returning `executeTool` itself and `scope.run` calling `fn`.

## Not verified

- **No live Lab run or real DeepSeek call.** Every proof uses a fake fetch.
- **Request size and timing.** I did not measure the synchronous write and render of a real ~1.4 MB decision request, which means `request.json`, `request.txt` and its `JSON.parse` on the event loop for each call.
- **Concurrent writers.** I did not test two processes writing to the same directory. Numbering then relies on `EEXIST` only within a kind (see Open questions).
- **Temp+rename of `index.md` on Windows.** It was exercised by repeated rewrites in the tests, which passed. I did not separately confirm whether the rename or the direct-write fallback was taken.
- **Browser bundles.** The structure audit's `browser-imports` rule passed, so `node:async_hooks` and `node:fs` do not reach a browser entry. I did not run the web-extension bundle build.

## Open questions or contradictions found

1. **The "no file contains authorization" proof cannot hold for `request.json`.**
   - Core's own decision system prompt contains the word: "never derive or copy an executable handle, target, patch, permission, or authorization from reusableContext".
   - A byte-identical `request.json` (and `request.txt`) therefore always contains "authorization".
   - The test instead asserts no `authorization:` and no `"authorization"` in any file. That excludes both ways a header could be written.
   - It also asserts no file contains the resolved secret or "Bearer". The secret in the test is deliberately not credential-shaped, so it proves the secret is never handed over, not merely that it is redacted.
2. **Numbering across processes.**
   - Within one process, numbers are unique, because the scan and the `mkdir` are synchronous and there is a per-process last-given number.
   - Across processes, non-recursive `mkdir` only collides on the same name, so the same number can be taken by two processes if they choose different kinds, for example `0005-decide` and `0005-tool-x`.
   - The brief's contract (mkdir and bump on `EEXIST`) gives exactly this. The Lab runs one Core per directory, so it does not arise today.
3. **The folder-open catch rethrows a non-errno throw.**
   - To satisfy `failure-as-empty`, only an errno-coded failure means "no step". Any other throw from opening a folder (a defect) propagates.
   - In the provider it becomes `llm.provider_network_error`; in panel-command and tool steps it propagates as is.
   - Every other step-log failure (file writes, rendering, meta, index) is swallowed with `/* best-effort: ... */`.
4. **Fields added beyond the brief.**
   - `meta.json` also carries `summary` (needed to rebuild `index.md` after a restart), `httpStatus` and `status` on model steps, and `status` on tool steps.
   - The Lab can ignore them.
