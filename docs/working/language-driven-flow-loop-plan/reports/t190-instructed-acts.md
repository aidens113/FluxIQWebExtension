# t190 — instructed acts and the reload-causing click (lane report)

Lane lead report, 2026-09-29. Core `C:/Users/osrs_/FluxStuff/fxwork/t190/!FluxIQ` and downstream
`C:/Users/osrs_/FluxStuff/fxwork/t190/!FluxIQWebExtension`, both on `task/t190-instructed-acts`,
from Core `528f52d` and downstream `e8d90988`. Evidence: t174-w3's report and the debug of
`run-muncqlr0-3348202b` (run 6, bigbox-retail-pickup-cart).

## Status

**Ready to commit.** All four causes are fixed and tested, and both list cuts now say how much
they withheld. Nothing is committed. Worker reports are `t190-w1-act-split.md`,
`t190-w2-act-claims.md`, `t190-w3-reload-click.md` and `t190-w4-arrival.md`, all beside this file.

## Decisions

1. **Cause 3 is fixed in the domain, not in `start-step.ts`.** Core cannot write the arrival
   step itself, for four reasons:
   - It does not know which domain node goes to a location, or under which parameter. No field
     of a node definition says so (`nodes/definitions.ts`).
   - The web library has two nodes whose only required parameter is free text:
     `web.browser.navigate` `url` and `web.dom.wait_for_text` `text`.
   - `library-locations.ts` says on purpose that choosing the node is the domain's business.
   - The completion call site (`llm/harness-options/bootstrap-completion.ts:204`, t189's file)
     passes only `steps` and `startLocation`.

   Core also records the initial observation as `effect: "observe", effectApplied: false`
   (`llm/evidence-loop.ts:494`). A navigation made inside that first look could therefore never
   become a kept step.

   In run 6 the build began with the page already open. The domain's arrival rule is enforced
   only by the blank tab refusing everything, so it never fired. The fix makes arrival a fact of
   the build rather than of the tab: a build told a start location has not arrived until one of
   its own navigations succeeds. The arrival step therefore always runs and is always in the
   draft, and `start-step.ts` already puts it back if an amendment withdraws it. `start-step.ts`
   is unchanged.
2. **Cause 1: the run-6 premise was wrong, and the fix stays.** This agrees with t189 G3 and
   w3. The node-run success path returned `effectApplied: true` and `proposes: true` for
   `pick-millbrook` (`web.action.succeeded` is only produced there), and the model withdrew the
   step itself in the iteration-21 amendment. Showing the model that it withdrew a step that
   worked is t189's work.

   The coordinator asked for no speculative change if capture was correct. Capture was **not**
   correct for one real window. When the look after an action lands between two documents,
   that look's `page_unreadable` was raised as the call's own refusal. A click that had worked
   then came back as refused with `effectApplied: false`, and could never become a Flow step.
   w3's tests fail on the old code for exactly that reason. The extension already re-sends
   `web.dom.assert` across a navigation for the same documented failure. So the change fixes a
   proven defect; it was not a guess about run 6. It is kept, and it is not claimed as run 6's
   cause.
3. **List cuts (t188's 100-node setting):**
   - `instructed-acts/check.ts` `MAX_LISTED_STEPS` went from 32 to 100. A cut list now carries
     `stepsWithheld: <count>`.
   - `reachability/check.ts` `MAX_FEEDBACK_STEPS` went from 24 to 100, and its stale "sixteen
     per subflow" comment is fixed. `stepsWithheld` changed from `true` to a count; nothing in
     Core read it as a boolean.

   Both lists were scaled **and** now report the cut.

## Findings and fixes

- **Cause 5, one act per counted object (w1, Core `instruction-acts.ts`).**
  - Each act's quote is now its own clause: from its verb to the next act's verb.
  - An `add_to` or `save` over several counted objects ("two packs of A ... and one pack of
    B ... to my cart") becomes one act per object. Uncounted objects stay one act ("the kettle
    and the toaster"), and so do coordinated verbs ("Collect and use ...").
  - Run 6's instruction now reads as 3 acts, observed by the lead:
    - a1 `set`/"switch": "Switch my pickup store to Millbrook Crossing Supercenter".
    - a2 `add_to`: "add two packs of the ValueRidge Essentials Select-A-Size Paper Towels in
      the 12 Double Rolls size to my cart, both for pickup".
    - a3 `add_to`: "add one pack of the ValueRidge Everyday Dinner Napkins in the 250 Count
      size to my cart, both for pickup".
  - w1 swept all 58 live-task ids of the ten scenarios, before and after. Kinds and verbs
    changed only on the two bigbox pickup-cart ids; every other difference is a narrower
    quote.
  - Side effect: quotes now start at the verb, so a lead-in such as "On Hammerline," is no
    longer quoted. The whole instruction is still in the model's context.
- **Cause 4, a claim must name its act (w2, Core `instructed-acts/check.ts`).**
  - The in-order fallback `take(act, () => true)` is removed.
  - A claim answers an act only by:
    - its id;
    - a word that only its quote holds among acts of its kind ("napkins" against "paper
      towels");
    - its verb;
    - a kind word.
  - The feedback now tells the model to name each act by its id.
  - End to end on run 6's text: claims "switch store", "add paper towels" and "add dinner
    napkins" pass. A towels-only Flow is refused with a3 `no_step_named`.
  - Still possible: a model that names the wrong press for an act passes (for example "open
    store picker" matches the kind word "store"). Core cannot see what a press did; the run's
    own verification stays the backstop.
- **Cause 1, a reload between documents (w3, domain `capture.ts`, `node-run/run.ts`,
  extension `runtime/action-runner.ts`).**
  - The look after an action waits out `page_unreadable` for up to 5 s, retrying every
    250 ms, and cancellation ends the wait at once.
  - The extension re-sends `web.dom.capture_snapshot`, which only reads, when the first send
    met a navigating page.
  - A page still unreadable after the window is reported as applied with
    `pageUnreadable: true`, and the step stays proposable.
- **Cause 3, arrival per build (w4, domain `node-run/arrival.ts` (new), `run.ts`,
  `start-location.ts`, `tools.ts` wiring).**
  - Arrival is remembered per (session, project, flow), for at most 16 builds.
  - Core's opening call (`initial.` callId, Core's naming) re-arms it.
  - It is set by a successful navigation, or by a replayed navigation step. A dry-run reset
    does not set it.
  - Dry runs are never gated.
  - A request with no `startLocation` is untouched. Repair re-authoring
    (`runtime/service/runtime-adaptation/refuted-result-port.ts:86`) sends none, so repair is
    unaffected.

## Contract for t189 (cause 1)

This is what the domain now guarantees for a `core.run_node` call whose node succeeded and
whose action starts a navigation or reload of the page it acted on. The domain does not need
to know that it did.

- **When the new document becomes readable within the window:**
  - The result is `effectApplied: true`, with `resultCode: "web.action.succeeded"` (or
    `web.inspect.succeeded` for an observe node).
  - `draft` is `{ actionId, effect, input, ranWith, proposes: <node.proposes>, replay: { from:
    { location: <page the step acted on> } } }`, identical to a click that does not navigate.
  - `evidence` is the sanitized packet of the **new** document. `pageChanged` is `true`
    unless the packet is byte-identical to the one before, and there is no `pageUnreadable`.
  - Nothing on the wire says that a navigation happened, so Core must not look for such a
    field.
- **Timing:** `executeTool` returns only after one look has read a document.
  - Looks repeat every 250 ms until 5 s after the first look that follows the action.
  - In the extension, each look first waits for tab status `complete` plus 1 s of URL
    stability (`waitForTabReady`, capped at 20 s).
  - A normal reload is read about 1 to 2 s after the click.
- **`stateAfter`:** Core's `captureStateDigest({ phase: "after" })` runs after `executeTool`
  returns, so it digests the loaded new document.
- **When the new document is never readable within the window:**
  - The result is still `effectApplied: true` and `web.action.succeeded`, with the same
    `draft`, so the step stays proposable.
  - `evidence` is `{ ok: true, node, status: "succeeded", pageUnreadable: true, control?,
    read?, inFlow }`, with no page and no `pageChanged`.
- **Cancellation:** `executeTool` rejects at once with `signal.reason`.
- **Not covered:** a navigation that starts more than about 1.3 s after the click, once the
  look has already read the old document. The step is still applied and proposable, but the
  evidence and `stateAfter` describe the old document. Covering it needs a navigation or
  document-identity signal on the result, which is a wire change.

## Validation

All commands were run by the lead on the t190 trees after every worker had finished.

- `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts src/programs/automation-studio/runtime/flow-bootstrap/reachability --maxWorkers=2 --minWorkers=1`
  -> `Test Files 4 passed (4)`, `Tests 77 passed (77)`.
- A scratch vitest (deleted afterwards) with run 6's instruction:
  - 3 acts, as quoted above;
  - claims naming the store switch, the towels and the napkins -> `ok: true`;
  - a towels-only draft -> refused, `[{"id":"a3",...,"reason":"no_step_named"}]`.
- `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap --maxWorkers=2 --minWorkers=1`
  -> `Test Files 34 passed (34)`, `Tests 704 passed (704)`.
- Core, `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t190-lead core check" pnpm check`
  -> `exit=0`. It printed `structure-audit: passed (197 warning(s), 355 baselined)` and `tsc
  --noEmit` Done for contracts, client-gateway-websocket, fluxiq and apps/web. It also printed
  "1 baseline entries can be lowered"; this lane did not run `pnpm structure:baseline`.
- Downstream, `heavy.sh "t190-lead domain test" env DOMAIN_TEST_BUILD_LABEL=t190-lead pnpm --filter @fluxiq-web-extension/domain test`
  -> `exit=0`, `# tests 900`, `# pass 900`, `# fail 0`.
- Downstream, `heavy.sh "t190-lead downstream check" pnpm check` -> `exit=0`. Extension,
  scenario-lab, agent-orchestrator, test-evidence and test-runner all printed Done.
- Downstream, `heavy.sh "t190-lead extension test" env EXTENSION_TEST_BUILD_LABEL=t190-lead pnpm --filter @fluxiq-web-extension/extension test`
  -> `exit=0`, `# tests 1156`, `# pass 1156`, `# fail 0`.
- Workers also showed each new test failing before its fix:
  - w1: 3 failed on the old extractor.
  - w2: 6 failed on the old check.
  - w3: domain 3 and extension 3 failed on the old sources.
  - w4: 3 failed with arrival forced to `true`. That simulated the old behaviour rather than
    running the old code.

## Changed files

- Core, `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/`:
  - `instructed-acts/instruction-acts.ts`, `instructed-acts/check.ts`,
    `instructed-acts/contracts.ts` (doc comments only);
  - `instructed-acts/tests/instruction-acts.test.ts`, `instructed-acts/tests/check.test.ts`;
  - `reachability/check.ts`, `reachability/tests/check.test.ts`.
- Downstream, `domain/src/runtime/llm-evidence/`:
  - `capture.ts`, `tools.ts`;
  - `node-run/run.ts`, `node-run/start-location.ts`, `node-run/index.ts`, and the new
    `node-run/arrival.ts`;
  - new tests `tests/capture-after-action.test.ts`, `node-run/tests/reload-click.test.ts` and
    `node-run/tests/arrival.test.ts`.
- Downstream extension: `apps/extension/src/runtime/action-runner.ts` and
  `apps/extension/src/runtime/tests/action-runner.test.ts`.
- Reports: this file and `t190-w1..w4-*.md` in the same folder.

## Not verified

- No live, Lab or browser run, as the brief required. Real Chrome and Firefox behaviour across
  a reload, and the arrival refusal on an already-open page, are unproven until t174's bigbox
  run.
- Nothing shows what the packet after `pick-millbrook` actually contained in run 6.
- The downstream `tools.ts` `captureStateDigest` makes one plain capture. For a build **with
  no start location** whose post-reload page never becomes readable, the digest throws
  `page_unreadable`, and Core records a failed step. This is pathological (the page is still
  unreadable after 5 s plus the extension's wait) and was left as it was.
- A resumed build: Core's `initial.` look runs before the resume dry run
  (`evidence-loop.ts:455-510`). That look is refused as not arrived, and the replayed
  navigation then sets arrival. The model may still add a redundant navigation step after
  seeing the refusal. This is reasoned from the code, not tested end to end.
