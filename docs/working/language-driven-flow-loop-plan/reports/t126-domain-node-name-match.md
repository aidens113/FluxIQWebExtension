# t126 — web domain: a node name is resolved, not looked up

## Outcome

**Partial.** The code and its tests are done and pass against Core's real
matcher, but the two validation commands the brief names cannot pass yet:
Core's `name-match/` exists only in Core's *source*, not in its built `dist/`,
and this repository resolves `fluxiq` through Core's package export map, which
points at `dist`. The brief forbids rebuilding Core, so the domain type check
and the domain test suite both fail on the missing export until the Core side is
built. Nothing else is outstanding.

Evidence that the logic is right was obtained without touching Core: a scratch
harness that resolves `fluxiq` exactly as the normal test build does — Core's
dist — with one substitution, the automation-studio nodes barrel also
re-exporting Core's `name-match/` source. `name-match` imports nothing but its
own siblings, so it bundles cleanly on its own. **29 of 29** node-run tests pass
that way, and **810 of 811** across the whole domain suite.

## What changed and why

### `domain/src/runtime/llm-evidence/node-run/catalog.ts`

`webRunnableNode(definitionId)` was a bare `Map.get`. It now resolves: the exact
id first (a free `Map.get`, so a correctly written call is never scored against
the catalog), then `automationStudioMatchName` from
`fluxiq/automation-studio/nodes` over the runnable ids. A name nothing plausible
was written for still returns `undefined`, so `node_not_runnable_here` stays
reachable.

The candidate list is memoised beside the existing node map and carries `id`
only — no `accepts`, because a node id is not a slot with a value shape, so
there is nothing for the matcher's shape tie-break to read.

The header comment gained two paragraphs: why the ids invite being written wrong
(`web.dom.extract_list` becomes `web.output.dom-extract_list`, because the id
builder turns dots into hyphens and leaves underscores alone, so the plain
kebab-case form names nothing), and what the caller gets back.

`webRunnableNodeIds()` and `webObservationNodeId()` are untouched.

**On "the resolved node must be the one that runs".** It already is, and no edit
to `run.ts` was needed. `run.ts` reads `node.actionType` for the command it
dispatches, and `node.definitionId` for `record.actionId`, for the evidence's
`node`, for `resolveWebPlanNodeParameters`'s `nodeDefinitionId`, and for the
draft statement's `actionId` — all of them the catalog's values, which are now
the *resolved* ones. Verified end to end by a test: a call naming
`web.output.browser.navigate` dispatches `web.browser.navigate` and appends a
draft step whose `actionId` is `web.output.browser-navigate`.

The one place the written spelling survives is the draft step's `input` and
`ranWith` JSON, built by `nodeCall` in `run.ts` (not mine to edit). That is not a
Flow-breaking name: Core states in `AS/runtime/flow-draft/step.ts` that both
fields are opaque JSON it never reads and only carries, and the only consumer is
this domain's own `replayWebOutputNode`, which resolves `value.node` through this
same `webRunnableNode` — so a replay of a corrected step now finds the same node
the original run did. A test asserts exactly that round trip.

### `domain/src/runtime/llm-evidence/node-run/tests/catalog.test.ts` (new)

Seven tests: the exact id resolves and yields the catalog's own entry
(`definitionId`, `actionType`, `effect`, `proposes`); `dom-extract-list`,
`dom_extract_list` and `webOutputDomExtractList` all resolve to
`web.output.dom-extract_list` while `web.output.dom-extract` still resolves to
itself; two case variants of `dom-click`; `navigate` and `click-element`
resolving short; `banana`, `sendEmail`, `builtin.logic.and`, `""`, `"   "`,
`undefined` and `42` all still `undefined`; `webRunnableNodeIds()` unchanged,
sorted, and containing catalog ids only; and the end-to-end run described above.

### `domain/src/runtime/llm-evidence/node-run/tests/run.test.ts` (one stale assertion repaired)

Not part of the brief's task, but inside the directory it gives me, and red
before I started. Commit `9002620` ("This domain says which nodes it runs") added
`runnable: webRunnableNodeIds()` to `runsNodes` in `tools.ts` and did not update
the two tests that deep-compare it. `run.test.ts:44` now expects `runnable` too.

## Commands run and observed results

`pnpm --filter @fluxiq-web-extension/domain test` — **fails, on Core's unbuilt
dist**, exit 1:

```
37 of 102 domain test entries failed to load:
SyntaxError: The requested module 'fluxiq/automation-studio/nodes' does not provide an export named 'automationStudioMatchName'
```

Every entry whose bundle transitively reaches `catalog.ts` fails to *load*; none
of them runs an assertion. The other 65 entries ran and reported no failure.

`cd domain && npx tsc -p tsconfig.json --noEmit` — **fails, same cause**, exit 2,
one error and no other:

```
src/runtime/llm-evidence/node-run/catalog.ts(49,10): error TS2305: Module '"fluxiq/automation-studio/nodes"' has no exported member 'automationStudioMatchName'.
```

The same command on the tree *before* my change exits 0, so this is the only
error I introduced and it is a build-ordering one.

Scratch harness (`fluxiq` → Core dist, plus Core's `name-match/` source), the
four `node-run/tests/` entries — **29 tests, 29 pass, 0 fail**, including all
seven new ones. Re-run after Core's `similarity.ts` changed under me mid-session
(a typo-distance floor was added); still 29/29.

Scratch harness, all 102 domain test entries — **811 tests, 810 pass, 1 fail**.
The one failure is `domain/src/runtime/llm-evidence/tests/tools.test.ts:105`, the
second half of the stale `runnable` expectation described above. That file is not
in my brief's owned paths, so I left it; the fix is the same one-line shape as
the `run.test.ts` repair.

`node scripts/structure-audit.mjs` — exit 1, one violation, unrelated to me:
`FAIL [working-docs] docs/working/README.md is out of date with the documents'
header blocks.` No `file-lines` warning for either file I touched.

Harness:
`C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\e2b222cb-b072-4fe0-aa87-41a7c7362681\scratchpad\t126-run-with-core-source.mjs`.
It writes only into that scratch directory; neither repository was modified by
it, and Core was never built.

## Not verified

- **The two commands the brief names have not been observed passing.** They
  cannot be until `pnpm --filter fluxiq build` runs in Core. That is the whole of
  what is outstanding, and it is a Core-side build, not a domain change. Re-run
  both after the Core side of t126 lands.
- **No live browser run.** The end-to-end test drives a stub gateway, so what is
  proved is that the resolved node's command is dispatched, not that a real page
  responds to it.
- **The matcher's own scoring** is Core's and was not re-measured here. What I
  checked is the behaviour of the ids this domain actually has, against the Core
  source as it stood at the last re-run; `similarity.ts` changed once while I was
  working, and could change again.
- **Whether `input`/`ranWith` carrying the written spelling ever reaches a model
  or a Flow by a path other than replay.** I traced `actionId` (Core records it,
  never interprets it) and the replay round trip (resolved through
  `webRunnableNode`); I did not audit every Core consumer of a draft step.

## Open questions or contradictions found

1. **`tools.test.ts:105` is red at HEAD and I could not fix it.** Same stale
   `runnable` expectation as `run.test.ts:44`, in
   `domain/src/runtime/llm-evidence/tests/tools.test.ts`, which my brief neither
   grants nor forbids. It has been failing since commit `9002620`, so the domain
   suite was already not green before t126. Worth a one-line follow-up.

2. **Should the model be told its name was corrected?** Core's matcher returns
   `how` (`exact` / `normalized` / `nearest`) and a score precisely so a caller
   can report the correction rather than substitute silently, and Core's own
   `match.ts` says a caller "reports `how` back to the model and to the run
   record". This change discards it: the model writes
   `web.output.dom-extract-list`, the right node runs, and nothing tells it the id
   it wrote is not the id. That is the right default — the run should not stop to
   teach — but a `nearest` match is a guess, and a guess that never surfaces
   cannot be audited from a run record. The brief did not ask for it, so I did not
   add it. It would fit naturally in the evidence the node outcome already
   carries.

3. **Should the draft carry the corrected name in `ranWith` too?** It does not,
   because `nodeCall` is in `run.ts`. I am satisfied it is harmless (see above),
   but the brief's wording — "the step recorded in the draft must carry the
   catalog's id, never the model's spelling" — is satisfied by `actionId` and not
   by `ranWith.node`, and someone reading only the brief may expect otherwise.
