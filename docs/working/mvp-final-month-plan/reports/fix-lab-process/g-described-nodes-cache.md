# t289-G (W11): a node's definition no longer breaks the provider's prefix cache

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t289/!FluxIQ` (uncommitted). R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. A node described in the middle of a build now reaches the model inside the evidence window, on the result of the call that first described it. No byte in front of the window changes. Each definition still appears exactly once per request. The head's `flowBootstrap.describedNodes` now holds only described nodes that no entry of the current window names. In practice those are nodes an earlier round described, so the head is fixed for the length of a window.

**The lead's finding was confirmed before the change.** After t280 the collapse was bounded to one break per distinct node but not gone. The fail-first test showed the second request diverging from the first at byte 4,193. That is where `builtin.logic.or` was appended to the head's `describedNodes`, in front of the tools (byte 4,212) and the window (byte 4,440).

## Design (as built)

- **Marker on the result.** When a call newly describes a node, the wrapper (`R/llm/node-tools/describing-failures.ts`) adds `describedNodes: ["<id>"]` to that call's evidence object, beside what the domain wrote and never over it. It does this whether the call succeeded, was refused or was written. The receipt from `core.describe_nodes` (`describe-nodes.ts`) names the newly described ids under the same key. The key is `AUTOMATION_STUDIO_LLM_DESCRIBED_NODES_KEY` in the new file `R/llm/node-tools/described-nodes-key.ts`.
- **Placement on the wire.** In `R/llm/deepseek/request-body.ts`, `placeDescribedNodes` puts each definition from the packet's `flowBootstrap.describedNodes` on the first window entry that names it, in place of the id. Entries are copied with their key order kept, so an entry renders the same bytes on every request. Described nodes that no entry names go to the head's `describedNodes`.
- **What the packet holds.** The packet (`context-packet.ts`) is unchanged in behaviour (comment only). Its evidence keeps only ids. So the denied-key screen and the pre-send evidence check never see catalog text; a parameter id such as `selector` in a definition cannot trip the web domain's denied keys.
- **When a node is not described.**
  - A call that threw has no result to carry the marker, so it no longer describes its node. Its next run does. t280 described it there, which put the definition in the head mid-build.
  - A result that is not an object, or that already holds the key, describes nothing.
- **Why only the first result is marked.** Only the call that newly describes a node carries the marker; later runs of the same node come back untouched. If every run were marked, a node an earlier round described would move from the head to the window when it ran again, which would change the head.
- No file outside my owned paths needed a change: no edit to `evidence-loop*`, `decision-context/**` or `service.ts`.

## Bytes before and after

Fixture: the new fail-first test. Builtin nodes, global resolution, the real wrapper, the real packer (`packAutomationStudioLlmContext`) and the real DeepSeek adapter body. The opening call runs `builtin.logic.and`; the model's first call runs `builtin.logic.or`.

| | before (today's code) | after |
| --- | --- | --- |
| request 1 user message | 5,544 bytes | 5,537 bytes |
| request 2 user message | 6,167 bytes | 6,179 bytes |
| end of request 1's window | byte 4,613 | byte 4,606 |
| shared prefix of request 1 and request 2 | 4,193 bytes (break before tools at 4,212 and window at 4,440) | 4,606 bytes (all of request 1 up to the end of its window) |
| where `describedNodes` first appears in request 1 | byte 3,696 (head) | byte 4,106 (inside the window, on entry 0) |

On this small fixture, the tools and the one-entry window (420 bytes) had to be read again uncached. In a live build the same break re-read the tools (about 6k characters) and the whole window, once per newly described node. The live costs were about $0.008 in `run-murzln6g` (C18) and $0.0031 in `musp4h2f` (cause 12). After the change a describe only appends.

## The fail-first test

`R/llm/tests/provider-cache-prefix.test.ts`, new describe block "a node described in the middle of a build", with 3 tests:

1. A run-described node: request 1 up to the end of its window is a byte prefix of request 2, and each definition appears exactly once.
2. A node described by `core.describe_nodes`: the same, plus a third request after rerunning an already-described node.
3. A node an earlier round described sits in the head, and the head is byte-identical across the window's requests.

**Before**, on today's code, all 3 failed:

```
× a node described in the middle of a build > reaches the model without changing a byte the previous request sent before the end of its window
  → everything the first request sent up to the end of its window: expected '{"taskKind":"evidence_tool_decision",…' to be '{"taskKind":"evidence_tool_decision",…'
× ... > does the same for a node the model asked core.describe_nodes about
× ... > keeps in the head only the nodes described before this window began, and the head never changes after
Tests  3 failed | 14 passed (17)
```

**After**: `Tests 17 passed (17)`.

The older test "keeps the prefix through the names and their note when a node is described between two calls" asserted the old head-append design. It was rewritten as "keeps the whole window cached when a node is described between two calls (t289-G)" and now uses hand-built window entries that carry the marker.

## Words changed (model-facing)

- **`run-node.ts` DESCRIPTION**: "A node you run is described for you, in flowBootstrap.describedNodes from then on." became "A node you run is described for you, under describedNodes in its first result." The description stays under its 1,500-character test.
- **`run-node.ts` PARAMETERS_DESCRIPTION**: "exactly as its definition in flowBootstrap.describedNodes declares them" became "exactly as its definition under describedNodes declares them".
- **`describe-nodes.ts` DESCRIPTION**: "A described node stays in flowBootstrap.describedNodes for the rest of the build, so never ask for it again. Returns a receipt; the definitions are shown there." became "Each definition is shown once, under describedNodes in the result of the call that first described it, for the rest of the build: never ask for one again." It is 390 characters, under the 400 budget.
- **`describe-nodes.ts` receipt**: `{ok, described, alreadyDescribed?, unknown?, shownIn: "flowBootstrap.describedNodes"}` became `{ok, describedNodes?, alreadyDescribed?, alreadyShown?: "under describedNodes, earlier in this request", unknown?}`.
- **`describing-failures.ts` refused-call notes**:
  - First refusal: `described: "<node> is now in flowBootstrap.describedNodes"` became the marker `describedNodes: [<node>]`, which carries the definition on the wire.
  - Later refusal: `definition: "<node> is in flowBootstrap.describedNodes"` became `definition: "<node> is under describedNodes, earlier in this request"`.
  - `undeclaredParameters` is unchanged.
- **`request-body.ts` catalog note**: "...Each node you run joins describedNodes, with its inputs, outputs and parameters, for the rest of this build. To read one before its first run, ask core.describe_nodes (several ids at once); never ask for one already there." became "...A node you run or ask core.describe_nodes about is described once, under describedNodes: on the result of the call that first did, or here if earlier. Ask before a first run only for its parameters; never ask twice." It is 281 characters, under 300.
- **Comments only**: the headers of `node-descriptions.ts`, `describing-failures.ts`, `describe-nodes.ts` and `run-node.ts`; the doc comments in `request-body.ts`, `request-shape.ts` and `context-packet.ts`.
- **Pinned prompt snapshots**: none moved. `git grep` finds no snapshot or pin file (including `deepseek/tests/system-prompt-pins.json`) that holds these words, so there was nothing to regenerate. The downstream `domain`, `apps` and `packages` trees do not mention `describedNodes` or `shownIn`.

## What changed (files)

All paths are under R.

- `llm/node-tools/described-nodes-key.ts`: new. The marker key.
- `llm/node-tools/index.ts`: exports the key.
- `llm/node-tools/describing-failures.ts`: adds the marker on a newly describing call; no longer describes a node on a throw or on a result that cannot carry the marker; new pointer wording.
- `llm/node-tools/describe-nodes.ts`: receipt and description.
- `llm/node-tools/run-node.ts`, `llm/node-tools/node-descriptions.ts`: words and comments.
- `llm/deepseek/request-body.ts`: `placeDescribedNodes`, the head holds only unplaced nodes, the note, the doc comment.
- `llm/deepseek/request-shape.ts`, `llm/harness/context-packet.ts`: comments only.
- **Tests**:
  - `llm/tests/provider-cache-prefix.test.ts`: 3 new tests plus 1 rewritten.
  - `llm/deepseek/tests/request-body.test.ts`: 1 new test covering placement, each definition once, the head holding only unplaced nodes, and the packet left untouched.
  - `llm/node-tools/tests/node-descriptions.test.ts`: 2 tests updated and 2 added (no description when the result cannot carry the marker; a thrown call describes nothing and the next run does).
  - `llm/node-tools/tests/describe-nodes.test.ts`, `llm/node-tools/tests/run-node.test.ts`: pinned words updated.
- **Outside the brief's listed files**: `llm/harness-options/tests/binding.test.ts`. Its 5 described-node tests pin the wrapper's old behaviour as `binding.ts` wires it: the receipt key, the refusal notes, a success returned untouched, and a thrown call describing its node. I updated them to the new behaviour, as t280 did with the same file. No production file outside the owned list was touched.
- All touched files were saved with CRLF line endings to match the tree.

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime/llm/tests/provider-cache-prefix.test.ts` (from `C/packages/fluxiq`)
  - Before the fix: 3 failed, 14 passed (17).
  - After: 17 passed (17).
- `npx vitest run <R>/llm/node-tools/tests <R>/llm/deepseek/tests <R>/llm/harness/tests <R>/llm/harness-options/tests <R>/llm/tests/provider-cache-prefix.test.ts` (R as a path from `packages/fluxiq`)
  - Midway: 11 failed. All were pinned old wording or behaviour, listed above.
  - Final: `Test Files 67 passed (67)`, `Tests 648 passed (648)`.
- `node scripts/build-cache/cli.mjs fluxiq:check` (Core root): exit 0, `{"step":"fluxiq:check","reason":"no stamp; stored in the shared store ..."}`.
- `node scripts/build-cache/cli.mjs structure-audit:check` (Core root): `structure-audit: passed (266 warning(s), 349 baselined).`, exit 0. Advisory warnings touching my files:
  - `node-tools/` now has 19 source files (threshold 15; there were 18).
  - `provider-cache-prefix.test.ts` is 485 lines (advisory threshold 400).
  - `context-packet.ts` is 569 lines (it was already past 400).

## Not verified

- No live or Lab run and no provider call (the brief forbids them). The cache saving is shown by byte prefixes, not by DeepSeek's `prompt_cache_hit_tokens`.
- I did not exercise the real evidence loop (`evidence-loop.ts`, `service.ts`) end to end with the marker. The tests drive the wrapper, the packer and the adapter directly.
- I did not check:
  - whether repair rounds start a fresh window. If the window carries over, the definitions stay on their entries; if not, they sit in the head. Both are correct and fixed for the length of a window.
  - what `core.recall_result`, the step log or the judge make of the small `describedNodes: [id]` key on a first result.
- Whole package suites, Core `pnpm build` and downstream checks were not run (per the brief).

## Open questions or contradictions found

1. **One-time byte difference for the repeat guard.** A node's first result now carries `describedNodes: [id]` and its later results do not. The repeat guard compares answer hashes for a repeated look (`repeat-guard/outcomes.ts`), and `noProgress.answered` compares the opening look's bytes. So an identical look repeated right after its node's first run is seen as a different answer once. In practice a repeated look is usually answered from memory first. Refused calls already behaved this way under t280. If this matters, the fix is in t287-owned files: compare evidence without the `describedNodes` key.
2. **Rare leak back into the head.** A described node can still reach the head mid-build if the loop discards the wrapper's result: an invalid execution result (`llm_evidence_loop.tool_result_invalid`) records a failure record instead of the evidence. That is the old behaviour (one break) and rare. Closing it would need `decision-handlers/failed-call.ts`, which I do not own, to carry the marker.
3. **Changed t280 behaviour.** A thrown library call no longer describes its node. That is deliberate (see Design) and the tests pin it.
