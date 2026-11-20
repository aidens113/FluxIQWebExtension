# t971: every judge in an attempt carries its attempt's key (worker report)

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t971/!FluxIQ` (off `dev` at `d33a47c69`, which includes t967). Nothing committed.

## Outcome

Done, with nothing committed. The adapter now reads every call's attempt key from the attempt's own frame as the call is sent, so a judge after a decision continues its own decider on every path that runs the attempt loop. This is proven end to end on the chat-started path.

## Diagnosis

**Live symptom (run-mwoq9g4l-dbd69bd6).** All 6 judges said `continuation {used: false, reason: "no_attempt_key"}`.

- 0087 ran on Sonnet, the decider's climbed rung, so the routing did see the attempt's ladder frame. Only the key was missing.
- It read 0 from cache, wrote 100,041 tokens and cost $0.281.

**Cause.** t967 stamped `metadata.attemptKey` on the request inside the routing provider's `runTask`, but a harness call never goes through that method:

- `llm/harness/sized-request.ts:73` asks the routing provider which model serves the request (`servedBy`).
- `llm/harness/run.ts:188` then hands that model's own provider to the call (`provider: served`).

So neither a decider's request nor a judge's ever carried a key, and the adapter could hold no decider prefix under one. t967's tests called the routing provider's `runTask` directly, which is why they did not see it. The frame is present on every path; only the stamp was on a path no harness call takes.

## What changed and why

- **New `llm/role-routing/ladder/attempt-key.ts`** (`automationStudioLlmAttemptKey`) returns the current attempt's key, read from the attempt's ladder frame.
  - Every call of an attempt is made inside that frame: its decisions, and the completion check they ask.
  - This holds whether a chat, a script, or a caller such as FluxNode started the attempt, since all three run the same attempt loop (`llm/attempt-loop/run.ts`).
  - The key is held per ladder object in a `WeakMap`: the same for all of an attempt's calls, another for another attempt, none outside every attempt.
- **The adapter** (`llm/anthropic/provider.ts`) now reads the key from the frame as the call is sent. It falls back to `metadata.attemptKey` only for a caller with no frame.
- **The routing stamp** (`llm/role-routing/provider.ts`) uses the same helper, for direct callers that read the request. Its comment now says a harness call does not take that path.

## Tests

- **`answer-first/completion/tests/judge-continues-decider.test.ts`** drives the chat-started path end to end:
  - It runs the service's answer-first generation with a caller (`generateFlowBootstrapAdaptation`, which `lab attempt` and the extension's chat reach), through the real harness and the real Anthropic adapter. Only the fetch is scripted, and the scripted library model writes each reply in the format the wire asked for.
  - The attempt reads the loans and completes. The judge's step meta says `continuation: {used: true, reason: "continues_the_decider"}`, and its wire request ends with the judge's system message after the decider's turn.
  - **Shown to catch the live bug:** with the adapter put back on t967's metadata-only key, the same test fails. The file was restored afterwards.
- **`judge-continuation.test.ts` and `ladder-resolution.test.ts`** still pass, 13 tests between them.

## Commands run and observed results

All vitest runs used `node ../../node_modules/vitest/vitest.mjs run --root <packages/fluxiq> <files>`, through `heavy-slot.mjs`.

| Batch | What it covered | Files | Tests |
| --- | --- | --- | --- |
| d1 | `llm/role-routing`, `models/providers/anthropic`, `llm/anthropic`, `llm/step-log`, `result-verification/flow-less` | 43/43 | 329 |
| d2a-c | answer-first `completion`, `attempt`, `flow-run`, `trail`, `tests`, `carry-on`, including the new end-to-end test | 93/93 | 236 + 318 + 16 |

Other checks:

- **Direct runs before the batches:**
  - the end-to-end test alone: `Tests 1 passed (1)`;
  - with the adapter put back on t967's metadata-only key: `Tests 1 failed (1)`;
  - restored, the adapter and routing tests: `Tests 13 passed (13)`.
- **Targeted `tsc`** (scratch tsconfig over the changed sources and the new test, deleted afterwards): `tsc exit=0`.
- **`node scripts/structure-audit.mjs`:** `structure-audit: passed (558 warning(s), 911 baselined)`.

## Not verified

- **Live run:** the next run's judges after a decision should show `continuation.used: true` and a large cache read.
- **FluxNode and scripted callers** run the same attempt loop and frame, but only the chat-started path is driven end to end here.
