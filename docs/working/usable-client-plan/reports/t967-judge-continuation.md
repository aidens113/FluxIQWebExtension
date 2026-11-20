# t967: the judge continuation never fired (worker report)

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t967/!FluxIQ` (`task/t967-judge-continuation-live`, off `dev` at `71d25f484`). Nothing committed.

## Outcome

Done, with nothing committed.

- **Continuation.** A judge that follows a decision now continues its own attempt's decider prefix whenever that prefix is held. That includes the case in run-mwohvt8n, where the prefix holds Core's own entries.
- **Fallback reason.** Each judge's step meta now says whether it continued, and why not where it did not.
- **Raw captures.** Captures are also left out on steps that move to another page.

## Diagnosis (run-mwohvt8n-a57cad8a, read from its step files)

Every judge of the run was sent on its own. Each request had a single user turn and the judge's own native format, and none was a continuation:

| Step | Attempt | Model | Cache read | Cache written | Cost |
| --- | --- | --- | --- | --- | --- |
| 0022 | 1, after decider 0021 | Haiku | 0 | 22,914 | |
| 0029 | 2, after a saved-Flow replay, no decision | Haiku | 3,537 | 184,966 | $0.120 |
| 0057 | 3, after decider 0056 | Haiku | 3,537 | 85,412 | |
| 0089 | after decider 0088 climbed | Sonnet | 0 | 110,566 | $0.287 |

### Cause 1: t965's guard can never hold

The guard asked every call in the decider's cached prefix to be in the judge's trail. Comparing each decider's prefix (its user blocks up to the last cache mark) with the following judge's trail, the prefix calls missing from the trail are all Core's own evidence entries. None of them passes through the attempt's call chain, so none can ever be in the trail:

- **0021 → 0022:** `core.route_state.1`-`.5`. The trail held all 9 site calls.
- **0056 → 0057:** `core.route_state.1`, `core.attempt_note.1`.
- **0088 → 0089:** `core.described_nodes`, `core.route_state.1`, `core.route_state.2`, `core.attempt_note.2`, and the forward run's own call `call.run_flow_forward.10`.

The routing worked: 0089 ran on the decider's rung, Sonnet. Only the builder fell back.

### Cause 2: raw captures survived

0029 is a replay judge. Before any decision it is a judge of its own by design, but it was 190k tokens. Step 3 of its trail, a press that opened a listing, carried a 190 KB raw capture of the *search page it was pressed on* (`outputs.result.result.snapshot`, 248 elements). t965's rule matched only the page the view *after* the step shows. A step that moves to another page carries the capture of the page it started on, which the step before it shows as its view.

### About the pair the lead named

0028 is a note, and 0029 judges a saved-Flow replay before any decision, which is correctly not a continuation. The decider/judge pair that should have continued is 0021/0022, so the proof is built from that pair.

## What changed and why

### 1. The attempt's identity comes from its caller, not from its evidence

- **Routing stamps every call.** `runtime/llm/role-routing/provider.ts` stamps each call made inside an attempt's ladder frame with `metadata.attemptKey`.
  - There is one ladder per attempt record, and the decider's calls and the completion judge both run inside its frame.
  - The key is held in a `WeakMap` per ladder object, so it is the same for all of an attempt's calls and different for another attempt.
  - A call outside every attempt frame, such as a replay judged before any loop, carries none. The key is never sent to a model.
- **The adapter matches by key.** `runtime/llm/anthropic/provider.ts`:
  - It holds each attempt's latest decider prefix under that key, for the latest 8 attempts.
  - A judge with `continuesDecider` continues only the prefix held under its own key.
  - The t965 call-id guard is gone from `models/providers/anthropic/continuation.ts`. The trail still leaves out calls the evidence above already shows.
  - Core's own entries in the prefix (route state, attempt notes, described nodes, forward runs) are this attempt's history and no longer stop a continuation.

### 2. The fallback reason is logged in the judge's step meta

`ModelTransportCall.continuation` (`models/transport/observation.ts`) flows through the Anthropic messages transport (`models/providers/anthropic/messages.ts`) into the model step's `meta.json` as `continuation: { used, reason }` (`llm/step-log/model-step.ts`). It appears on judge calls only. The values are:

| `used` | `reason` |
| --- | --- |
| `true` | `continues_the_decider` |
| `false` | `no_decision_in_this_attempt` |
| `false` | `no_attempt_key` |
| `false` | `no_decider_request_held_for_this_attempt_on_this_model` |
| `false` | `continuation_past_the_window` |

### 3. Raw captures of the page before as well as after

`result-verification/run-trail/of/attempts.ts` now drops the capture of any page the views around a step show: the step's view before (`stateRefs.beforeAction.summary.location`) as well as after.

## Tests

- **`models/providers/anthropic/tests/run-mwohvt8n-continuation.test.ts`** uses the 0021 decider and 0022 judge `request.json` files exactly as recorded (fixtures beside it). It checks that:
  - the decider's prefix holds the five `core.route_state.*` entries that no trail holds;
  - the continuation built from the two requests has every top-level member except `messages` byte-equal to the decider's, the same key order, and user blocks byte-equal up to the decider's last cache mark;
  - after the mark come the judge's message, with no call the evidence above shows and `shownAbove` saying how many, and then a system message holding the judge's own instructions.
- **`llm/anthropic/tests/judge-continuation.test.ts`** now stamps attempt keys:
  - same key: the judge continues;
  - another attempt's key: the judge is sent on its own;
  - the step-meta `continuation` reads used, then no prefix held for this attempt, then no decision in this attempt.
- **`role-routing/tests/ladder-resolution.test.ts`:**
  - all calls in one attempt frame carry the same `attempt.N`;
  - another frame gets another key;
  - a call outside any frame has none.
- **`run-trail/tests/raw-capture.test.ts`:** 0029's trail entry 3 (fixture `run-mwohvt8n-press-entry.json`) loses its 248-element capture of the page it was pressed on, and keeps its `url` and validation.

## Commands run and observed results

All vitest runs used `node ../../node_modules/vitest/vitest.mjs run --root <packages/fluxiq> <files>`, through `heavy-slot.mjs`, in batches of 50 or fewer.

| Batch | What it covered | Files | Tests |
| --- | --- | --- | --- |
| c1 | `result-verification/tests` | 39/39 | 448 |
| c2 | flow-less, run-trail, build-test | 39/39 | 297 |
| c3 | role-routing, `models/providers/anthropic`, `llm/anthropic`, `llm/step-log`, `models/transport` | 32/32 | 228 |
| c4a, c4b | answer-first completion, attempt, flow-run, trail | 56/56 | 243 + 41 |
| c5a-d | the rest of `result-verification` | 145/145 | 298 + 326 + 284 + 77 |

All files passed. `llm/anthropic/tests/provider.test.ts`, which failed before t965 because of t962, now passes on this base.

Before the batches, the new and changed files were run directly:

- `run-mwohvt8n-continuation`, `raw-capture` and `judge-continuation` (old shape): 8 passed and 1 failed. The failure was the old adapter test, which sent no attempt key. It was updated.
- `judge-continuation`: 4 passed.
- `ladder-resolution`: 9 passed.

Other checks:

- **Targeted `tsc`** (scratch tsconfig over the changed sources and tests, deleted afterwards): `tsc exit=0`.
- **`node scripts/structure-audit.mjs`:** `structure-audit: passed (557 warning(s), 911 baselined)`, after splitting one packed line in the new routing test.

## Not verified

- **Live run:** the next run should show `continuation.used: true` in each judge's step meta after a decision, with a large cache read.
- **The before-page rule** depends on flow-run trace attempts carrying `stateRefs.beforeAction.summary.location`. The web host captures the page before each step, but no unit test runs the real engine for it.

## Open questions or contradictions found

1. **Paths outside the last list:** `runtime/models/transport/observation.ts` and `runtime/llm/step-log/model-step.ts`. Logging the reason in step meta needs both.
2. **Replay judges and caching:** a saved-Flow replay judged before any decision (0029) still has no decider conversation to continue. It now carries no raw captures, and keeps its trail cache marker.
