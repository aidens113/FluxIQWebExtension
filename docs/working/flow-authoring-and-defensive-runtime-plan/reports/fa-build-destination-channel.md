# t103 — a Flow bootstrap is told where its Flow starts

Worker report. Branches `task/t103-build-destination-channel` in both
`F:/fxwork/t103/!FluxIQWebExtension` and `F:/fxwork/t103/!FluxIQ`. No Lab run,
campaign, browser or provider call was made. Nothing was committed or pushed.

## Outcome

**Done.** The second of the report's three candidates is built: the Flow
bootstrap now takes a **start location**, and the build begins nowhere.

Three things happen at once, and they are the whole design:

1. The run tells Core where the Flow starts. It is a first-class field on the
   generation request, not text interpolated into the instruction.
2. Core shows it to the model and passes it to the bound domain on **every**
   tool call, including the free first look the loop takes before the first
   paid decision.
3. The web domain refuses every call with `not_at_start_location` — naming
   where to go — until the Flow has got there. The only call that runs from
   nowhere is the navigation whose destination is on the start location's
   origin.

Because a plan is assembled from the steps that ran
(`AS/runtime/flow-bootstrap/authoring/assemble-draft.ts`: "a plan built from it
cannot name a step that never happened"), the step that reaches the page is
now the Flow's own first step. That is the whole of the fix: nothing tells the
model to write a navigation node, and nothing inserts one. The model runs it
because it cannot do anything else, and the Flow keeps it because it ran.

**The enforcement is the world, not a rule.** There is no page to read, so the
capture every call makes first comes back refused. That is the same condition
the finished Flow meets at playback, where the extension refuses every action
on `about:blank` except a navigation, judged by its destination. A build cannot
now succeed under a rule its Flow will not face.

**`flowStartPage` no longer looks at the moment.** The build and the run are
both blanked for a `navigate` or `navigate-and-extract` task, and both keep
their page for a `form` or `extract` one. t101's open question 1 is closed by
doing it, not by deciding it was a measurement question.

---

## Which half went where

**Core (`F:/fxwork/t103/!FluxIQ`) — the capability.** "A Flow bootstrap has a
start location" is framework behaviour, so all of it is in Core, and Core never
parses the value: the spelling belongs to the domain, a URL for the web and
something else for a domain with no pages.

- **New** `runtime/flow-bootstrap/start-location.ts` —
  `automationStudioFlowStartLocation(value)`, the whole of what Core knows about
  it: bounded to 2,048 characters, trimmed, non-empty, no control characters
  (it reaches a prompt), and **thrown on rather than dropped**, because a build
  that silently lost its start location would explore from nowhere with nothing
  saying why.
- `api/contracts/adaptation.ts` — `startLocation?: string` on
  `GenerateFlowBootstrapAdaptationRequest`.
- `api/handlers/llm-generation.ts` — the field is allowed, read, and a bad one
  is refused as `Flow bootstrap generation request contains an invalid start
  location.` before the grant is inspected or anything is spent.
- `runtime/service/flow-bootstrap-commands/contracts.ts` + `service.ts` — the
  service input carries it; it is read once and handed on as a value.
- `runtime/llm/harness-options/binding.ts` — `executeTool`'s input gains
  `startLocation`, and the registry passes it. **On the call, not on the
  binding**, because it belongs to one build and a binding outlives every build
  made through it.
- `runtime/flow-bootstrap/plan/{catalog,contracts}.ts`,
  `runtime/llm/harness/{task-request,context-packet}.ts` — the bootstrap
  context carries it to the model, outside the catalog's byte budget, because
  where the Flow starts is not a node.
- `runtime/llm/deepseek-provider.ts` — `providerFlowBootstrap` puts it first in
  what the model is shown, with one sentence of Core's own beside it saying it
  is not there yet and its first call must be the node that goes there. A bare
  address in a context object is a fact; this is an instruction.
- `runtime/service/flow-bootstrap-commands/state-digest.ts` + `binding.ts` —
  the digest hook is told too, so the domain can answer *nothing* before the
  first step instead of throwing. This one is not cosmetic: the evidence loop's
  own comment says "a hook that throws makes the step a recorded failure", so
  without it the step that reaches the page would be a recorded failure of
  every such build.

**Core, incidentally.** `runtime/service.ts` was at 4,611 lines against its
ratchet and my additions took it over. Rather than shorten comments I moved the
twenty lines of request- and grant-field reading out to a new
`service/flow-bootstrap-commands/generation-request.ts` — a cohesive job with
one answer, next to the field readings it already used. Refusals are unchanged
word for word. `service.ts` is now **4,599 lines**, and
`pnpm structure:baseline` lowered the entry from 4,611.

**This repository — the web-specific half.**

- `domain/src/runtime/llm-evidence/node-run/start-location.ts` (new) — the rule
  and why it is a rule: the navigation is the one act available from nowhere,
  the refusal that names the start location, and the scope anchor.
- `node-run/run.ts` — a capture refused as `page_unreadable` **while a start
  location is declared** means "nowhere yet" rather than a fault; the free
  first look answers with `not_at_start_location`; any other call is refused
  the same way; the navigation runs with no current page; the origin the
  exploration is held to becomes the start location's; the step records the
  start location as its replay origin, so `replay.ts`'s reset can put the page
  back to the Flow's beginning. A build told **no** start location behaves
  exactly as it did: the refusal is raised as before, because "the page could
  not be read" is then the whole truth.
- `tool-rejection.ts` — one new code, `not_at_start_location`, one new reason,
  `start_location_not_reached`, and one new detail field, `startLocation`. The
  code is deliberately not `out_of_scope` or `cross_origin`: those two are the
  only codes `classifyRefusal` stops an exploration on, and this refusal is
  meant to be acted on, not to end the build. The detail field belongs there
  for the same reason `requestId` does — it was declared by whoever asked for
  the build and carried in by Core; no capture produced it.
- `capture.ts`, `tools.ts`, `harness-options/execute.ts` — the field on the
  request, and the state digest answering `undefined` from nowhere.
- `packages/test-runner/` — `build-proposal.ts` sends it, `lane.ts` takes it,
  `run-scenario.ts` supplies it, and `lane-rules/flow-start-page.ts` blanks the
  build. The address is one expression, `scenarioStartUrl(origin, scenario)`,
  used both by the load the harness makes and by the start location Core is
  told, so the page opened and the page named can never be two different pages.
- `docs/architecture/testing-facility.md` — the lane rule, why the build starts
  blank, and the seam's description of the new field.

`existing-fluxiq-control.ts` was **not** touched: it passes its input object
through to the request body, so widening the interface `build-proposal.ts`
declares was enough.

## One thing I changed beyond the brief, and why

`prepareFlowPage` now blanks **every** fixture tab, not only the one the runner
holds:

```ts
if (startPage !== "scenario-start-page") for (const open of [page, ...context!.pages().filter(other => other !== page && isScenarioUrl(other.url()))]) await open.goto(BLANK_TAB_URL);
```

t101 noted that a navigation run from a blank tab cannot take over the page in
front (`runtime/navigation-target.ts` refuses a page it cannot automate) and so
drives the last tab the worker drove, **or opens one**. With the build now
starting blank, that is no longer a corner case: the build's own first
navigation is the one that may open a second tab, and the exploration would
then end there rather than in the tab the runner holds. Blanking only that tab
would leave a fixture tab open, and the Flow's playback would start on a page
it never reached — which is exactly the defect this task exists to remove, in a
form nothing would report. Blanking them all makes the guarantee hold whichever
tab the exploration ended in.

## The portability question, settled

**A Flow's `navigate` node keeps the absolute address it ran with, and I did
not change that.** The reasoning, in order:

1. **The node holds what ran.** The design's whole claim is that a Flow is made
   of steps that provably worked. Rewriting the address into a placeholder at
   build time would put a node in the Flow that was never executed, which is
   the split this repository deleted on 2026-09-22.
2. **Portability is a different capability, and a bigger one.** "Re-point this
   Flow at another environment" needs a Flow-level input or setting, a binding
   syntax the model has to write into the node, a resolver at run time, and a
   surface for a person to set it. Every part of that would enter every built
   Flow untested, and I cannot run a live build to see whether a model writes
   the binding correctly. Guessing at it would risk the measurement this task
   unblocks.
3. **What this task does change is that the destination now has a name on the
   way in.** It was previously nowhere at all — not in the instruction, not in
   any context, not on the Flow. The bootstrap request is the half that had to
   exist first, and it now does: a future task can give the Flow an input
   defaulted to the build's start location and have the navigation bind to it,
   and the value it needs is already arriving.
4. **It costs the Lab nothing today**, because build and playback share a run,
   which is why the playback change works at all.

I did **not** persist the start location onto the created adaptation. It would
have been cheap, but nothing reads it yet, and the harness already proves what
it needs from the Flow's own nodes. Recorded as the obvious next step below.

## Commands run and observed results

### Core, `F:/fxwork/t103/!FluxIQ`

**`pnpm check`** — exit 0:

```
# pass 182     (structure:test)
# pass 20      (task:test)
structure-audit: 1 baseline entries can be lowered. Run "pnpm structure:baseline" to record the improvement.
structure-audit: passed (177 warning(s), 360 baselined).
packages/contracts check: Done
packages/client-gateway-websocket check: Done
packages/fluxiq check: Done
apps/web check: Done
```

**`pnpm structure:baseline`** — the improvement recorded:

```
lowered [file-lines] packages/fluxiq/src/programs/automation-studio/runtime/service.ts: 4611 -> 4599
structure-audit: baseline written: 360 entries across 10 rules (1 lowered, 0 removed).
```

**The tests for the change** (`vitest run` over `flow-bootstrap`,
`llm/harness-options`, `api/handlers`, `runtime/service`) — 532 passed, 1
failed on a 15-second timeout, and that one passes alone:

```
Test Files  1 failed | 60 passed (61)
     Tests  1 failed | 532 passed | 1 skipped (534)
 FAIL  .../service/summaries/tests/run-detail-preservation.test.ts
 Error: Test timed out in 15000ms.
```

```
✓ src/programs/automation-studio/runtime/service/summaries/tests/run-detail-preservation.test.ts (3 tests) 9149ms
  Test Files  1 passed (1)  |  Tests  3 passed (3)
```

The three files holding the new tests, run together — all green:

```
✓ src/programs/automation-studio/runtime/flow-bootstrap/tests/start-location.test.ts (4 tests)
✓ src/programs/automation-studio/runtime/llm/harness-options/tests/binding.test.ts (8 tests)
✓ src/programs/automation-studio/runtime/flow-bootstrap/plan/tests/catalog.test.ts (30 tests)
Test Files  3 passed (3)   Tests  42 passed (42)
```

```
✓ src/programs/automation-studio/api/handlers/tests/llm-generation.test.ts (18 tests)
Test Files  1 passed (1)   Tests  18 passed (18)
```

**`pnpm --filter fluxiq test`** (the whole Core suite) — **17 of 3,026 failed,
and none of them is this change**:

```
Test Files  11 failed | 340 passed (351)
     Tests  17 failed | 3008 passed | 1 skipped (3026)
   Duration  324.39s ... tests 2385.75s
```

Every failure is one of two environmental shapes, and each file passes when run
on its own:

```
Error: EBUSY: resource busy or locked, unlink 'C:\Users\mrjoh\AppData\Local\Temp\fluxiq-automation-studio-project-runtime-stream-store-test\projects\project.million\project.sqlite'
Error: Test timed out in 15000ms.
```

Checked individually and green: `service-flows/tests/execution-digest.test.ts`
(4 passed), `service-bootstrap/tests/adaptation.test.ts` (9 passed),
`service/summaries/tests/run-detail-preservation.test.ts` (3 passed). The
SQLite path is under the machine's shared `Temp`, not the worktree, so a
concurrent Core test run anywhere on this machine collides with it — worth
knowing before reading a future failure of those files as a defect.

### This repository, `F:/fxwork/t103/!FluxIQWebExtension`

**`pnpm check`** — exit 0:

```
# pass 182     (structure:test)
# pass 88      (lab:test)
# pass 116     (task:test)
structure-audit: passed (100 warning(s), 121 baselined).
packages/boundary-audit check: Done ... packages/test-runner check: Done   (all 10)
```

**`pnpm test`** — every package green, 0 failures:

```
packages/test-contracts  # tests 125   # pass 125   # fail 0
packages/real-site-policy # tests 7    # pass 7     # fail 0
packages/boundary-audit  # tests 6     # pass 6     # fail 0
domain                   # tests 766   # pass 766   # fail 0
packages/test-matrix     # tests 17    # pass 17    # fail 0
packages/agent-orchestrator # tests 16 # pass 16    # fail 0
packages/test-evidence   # tests 17    # pass 17    # fail 0
apps/extension           # tests 740   # pass 740   # fail 0
apps/scenario-lab        # tests 571   # pass 571   # fail 0
packages/test-runner     # tests 1330  # pass 1330  # fail 0
```

(766 domain tests against t101's 760: six new. 1,330 test-runner tests against
t101's 1,326: four new.)

The structure audit was re-run after the documentation edits and still passes.

### The replay through `test-runs/instances/r5/`

`t103-replay-r5.mjs` in this session's scratchpad, against the **built** domain
and test-runner packages of this worktree. No browser, no Core, no provider. It
reads each run's recorded `snapshots/flow-lane.json` and `run.json` from the
supervisor's checkout, puts the task through the real `flowStartPage`,
`scenarioStartUrl`, `createdFlowOwnPage` and
`assertCreatedFlowReachesItsOwnPage`, and then executes a build against a stub
gateway that behaves as a blank tab does.

```
=== run-mudwci8d-de88aa32 (navigate-and-extract, everything-store-first-page-plus-earbuds)
  flow shape            : navigationNodes=0 of 7 nodes; actions {"web.dom.click":3,"web.dom.extract_list":1,"web.dom.type":1}
  harness at build      : blank-tab
  harness at playback   : blank-tab
  start location told   : http://127.0.0.1:53705/scenarios/everything-store/
  own page              : {"required":true,"navigationNodes":0,"reached":false}
  lane says             : flow_lane.flow_does_not_reach_its_page: The created Flow holds no node that reaches its own page, so a navigate-and-extract task ran only because the harness had already loaded the page for it
=== run-mudw1ktb-0557816b (navigate-and-extract, everything-store-plus-earbuds-under-50)
  flow shape            : navigationNodes=1 of 5 nodes; actions {"web.browser.navigate":1,"web.dom.click":1,"web.dom.extract_list":2}
  harness at build      : blank-tab
  harness at playback   : blank-tab
  start location told   : http://127.0.0.1:53328/scenarios/everything-store/
  own page              : {"required":true,"navigationNodes":1,"reached":true}
  lane says             : passes the own-page judgement
```

The playback half is unchanged from t101 — that is the control. What is new is
`harness at build: blank-tab` and a start location that exists at all.

Then the build path itself, executed:

```
=== the build, from the blank tab t103 now leaves it on
  runsNodes.initial     : {"initial":{"node":"web.output.dom-capture_snapshot","parameters":{},"consequences":[]}}
  free first look       : web.action.rejected.not_at_start_location {"reason":"start_location_not_reached","startLocation":"http://127.0.0.1:53705/scenarios/everything-store/"}
  a press before going  : web.action.rejected.not_at_start_location
  state digest before   : none (the step is not failed for it)
  going to the start    : web.action.succeeded, effectApplied=true
  the step the Flow gets: {"actionId":"web.output.browser-navigate","proposes":true,"ranWith":{"node":"web.output.browser-navigate","parameters":{"url":"http://127.0.0.1:53705/scenarios/everything-store/"},"consequences":[]},"replayFrom":{"location":"http://127.0.0.1:53705/scenarios/everything-store/"}}
  looking, once there   : web.inspect.succeeded at http://127.0.0.1:53705/scenarios/everything-store/
  commands dispatched   : ["web.dom.capture_snapshot","web.dom.capture_snapshot","web.dom.capture_snapshot","web.dom.capture_snapshot","web.browser.navigate","web.dom.capture_snapshot","web.dom.capture_snapshot"]

  a Flow built this way : {"required":true,"navigationNodes":1,"reached":true}
  lane says             : passes the own-page judgement
```

Read against `run-mudwci8d`, that is the chain the task was for: the model
cannot press, is told where to go, goes there, and the step it took is one the
Flow keeps — and a Flow of that shape satisfies the judgement `run-mudwci8d`
fails.

I also confirmed by reading `AS/runtime/llm/evidence-loop.ts:460-487` that the
refused first look is an ordinary tool result, not a throw: it is pushed onto
the loop's evidence with its result code, so the model's **first paid decision**
is made already holding the refusal that names the start location. A throw there
would have ended the build at step zero.

## Not verified

- **Nothing ran in a browser or against a provider.** No Lab run, campaign or
  provider call. Everything about what the extension does on a blank tab is
  read from its source and from t101's reading of it.
- **Whether the build's first navigation drives the blanked tab or opens a new
  one.** `navigationTargetTab` refuses to take over a page the extension cannot
  automate, so from `about:blank` it falls back to the last tab the worker
  drove, else a new one. Whether the Core action probe earlier in the run
  leaves a tab recorded as "last driven" decides which happens, and I could not
  test it. Either way the run should work — a created tab is opened active, so
  it becomes the page in front for every non-navigation action, and
  `findScenarioPageWithExpectedState` scans every page — and the every-tab
  blanking above is what makes the playback guarantee hold in both cases.
  **This is the first thing to watch in the live run.**
- **Whether the model reliably writes `consequences: []` on the navigation.**
  `web.browser.navigate` is classified `review`, so a node call that omits
  `consequences` is refused `invalid_input` naming the keys. That is
  recoverable and the model is told, but it costs a turn if it happens, and no
  live build has been through this path.
- **A build whose page is genuinely unreadable for another reason** — mid-load,
  mid-navigation — while a start location is declared will now be told "go to
  the start location" rather than "the page could not be read". That reads
  correctly in both cases, but it does merge two situations that were
  distinguishable before, and no live run has exercised the second.
- **The failure screenshot for a build that cannot start** now falls back to a
  blank tab, as t101 noted for playback. Nobody has looked at one.
- **`pnpm build` was not run at either repository root.** `pnpm check`
  typechecked every project in both, and Core's `pnpm --filter fluxiq build`
  ran (the downstream typechecks against its `dist`).
- **Core's whole suite has 17 environmental failures on this machine** (above).
  I did not confirm they fail identically on `dev`, only that each file passes
  alone and that none is near this change.

## Open questions and contradictions found

1. **The start location is not persisted with the Flow.** Settled deliberately
   above. The natural next step, once a live build has produced a Flow this
   way, is to record it on the adaptation's bootstrap metadata and then give
   the Flow an input defaulted to it — that is what makes an
   instruction-built Flow portable across runs.
2. **Core does not check the plan reaches the start location.** Enforcement is
   the domain's refusal, which is honest — it is the same condition playback
   imposes — but it means a domain that binds `startLocation` and ignores it
   gets no help from Core. A binding hook of the shape
   `reachesStartLocation(step, startLocation)` would let Core refuse a plan
   whose first step does not go there, domain-neutrally. I judged the extra
   untested machinery a worse trade than the refusal that already works, and
   record the option rather than the omission.
3. **`web-flow-exploration.ts`'s section of `testing-facility.md` still
   describes the five retired exploration verbs** (`web.inspect_current_page`,
   `web.navigate_same_origin`, `web.press_control`, …) as the authoring
   surface, which they stopped being on 2026-09-22. I added the start-location
   paragraph to it but did not rewrite the stale description — it is a
   documentation debt beyond this brief, and worth a task of its own.
4. **The corpus still has no `navigate`-only and no `extract`-only task**, so
   two of the four kinds the rule is written and tested for are still not
   exercised by any real task. Unchanged from t101.

## What Core's paired working document should record

Core gained one capability, and it is not a Lab feature:

- **A Flow bootstrap may be told where its Flow starts.**
  `GenerateFlowBootstrapAdaptationRequest.startLocation`, an opaque bounded
  string in the bound domain's own spelling, validated by
  `runtime/flow-bootstrap/start-location.ts` and never parsed by Core.
- **Given one, Core tells three parties**: the model, through the bootstrap
  context, first among what it is shown and with a sentence saying it is not
  there yet; the bound domain, on every `executeTool` call including the free
  first look; and the domain's state-digest hook, so it can answer "no state"
  before the first step instead of failing it.
- **The binding contract grew two optional fields**, both on the call rather
  than on the binding: `executeTool({ …, startLocation })` and
  `captureStateDigest({ …, startLocation })`. A domain that ignores both is
  unaffected; a request that names no start location behaves exactly as before.
- **`runtime/service.ts` shrank from 4,611 to 4,599 lines**, by moving the
  generation request's field reading to
  `service/flow-bootstrap-commands/generation-request.ts`. The baseline entry
  was lowered to match.
- **Open for Core**: whether the bootstrap should record the start location on
  the adaptation it creates, and whether a domain should be able to answer
  "does this plan step reach the start location" so Core can hold a plan to it
  (item 2 above).
