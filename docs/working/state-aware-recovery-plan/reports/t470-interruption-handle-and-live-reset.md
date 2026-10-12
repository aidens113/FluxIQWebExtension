# t470: the model is shown the interruption it must handle, and live builds measure the model's own reset

Trees: Core `C:/Users/osrs_/FluxStuff/fxwork/t470/!FluxIQ` and downstream
`C:/Users/osrs_/FluxStuff/fxwork/t470/!FluxIQWebExtension`, both on
`task/t470-interruption-handle-and-live-reset`. Nothing is committed.

## Outcome

Done. Both parts are implemented and tested, and no paid run was made.

- **Part 1.** When a trial's run closes something the page put in the way, the trial feedback now names the
  control that closed it by a handle the model can write. The script format asks for a dismiss step only
  against that handle. With no handle named, it asks only for the pace.
- **Part 2.** A live (paid) candidate build gets no between-trial fixture reset. The ready receipt says
  `candidateTrial.fixtureResetBetweenTrials: false`.

## What changed and why

### Part 1: the interruption's way out, named by handle

**Root cause** (t465 defect 2, lane D round 8 `run-mv5jnc5m-a47c3e59`):

- The extension's interference defence closed the slow-down notice by its OK.
- That fact reached Core only as two closed words: `{kind: "rate_limit", control: "OK"}`.
- The trial feedback said nothing about it.
- The format still asked for a step closing the notice.
- The model had never been shown that OK, so it used "Close chat".

A handle has to resolve through the domain's per-Flow packet store, so the pressed control must reach the
domain with an address. Core must not hold page structure. The chain now runs as follows:

1. **Extension** (`apps/extension/src/content/action-runtime/interference/press-ways-out.ts`).
   - Before the press, each cleared-layer record also carries `wayOut: { url: location.href, element:
     describeElement(control) }`.
   - This is the same descriptor a capture puts in `interactiveElements`.
   - Only the top frame adds it. A child frame's descriptor has no frame address, so a handle built from it
     would name a top-document control.
   - The description is best-effort inside a `try`. A control that cannot be described is still pressed.
2. **Domain contract** (`domain/src/actions/cleared-layers.ts`).
   - New type `WebAutomationClearedWayOut`, and an optional `wayOut` on `WebAutomationClearedLayer`.
   - `webAutomationClearedLayersValue` keeps it only when it is an `http(s)` URL of at most 2,048 characters
     and one plain object of at most 16 KB of JSON.
   - Otherwise it drops `wayOut` and keeps the layer.
   - The gateway hop (`client/gateway-mapping.ts`) already copies through this sanitizer. Only its doc
     comment changed.
3. **Domain registry** (new `domain/src/cleared-way-outs/`: `registry.ts`, `owned-by.ts`, `index.ts`).
   - Keeps each way out under a random reference (`way-out.<32 hex>`).
   - Bounded to the newest 256.
   - One registry per FluxIQ instance, held in a `WeakMap`.
4. **Domain dispatcher** (`domain/src/io/gateway-output-dispatcher.ts`, new `coreClearedLayers`).
   - The lifted `clearedLayers` that Core reads now carries `{kind, control, wayOut: <reference>}`.
   - The client's own `result.clearedLayers` is replaced by the same referenced list, so the descriptor
     never reaches Core's trace.
5. **Core contract** (`executor/contracts.ts`, `executor/node-execution/cleared-layers.ts`).
   - `AutomationStudioClearedLayer.wayOut?: string` holds an opaque token.
   - The parser keeps it only when it matches `^[A-Za-z0-9._:-]{1,80}$`.
6. **Core binding** (`llm/harness-options/binding.ts`).
   - New optional `clearedControlHandles({projectId, flowId, wayOuts}) -> Record<reference, handle>`.
   - It is wired into the trial ports in `runtime/service.ts` (the candidate-trial port line).
7. **Core trial.**
   - `service/candidate-trial/contracts.ts` adds the port `clearedControlHandles`.
   - New `way-outs.ts` collects each reference from the trace once, at most 24.
   - `run.ts` asks the port only when the run pressed a way out, and passes `wayOuts` to the feedback.
   - New `interruptions.ts` gives each step an `interruptions` list:
     - each entry is `{kind, wayOut?, said}`, once per kind and handle, at most 4;
     - an entry with a handle says: "...and the run closed it by pressing its way out, t901.";
     - an entry without one says: "...closed it by itself. No control of it is named, so no step of the Flow
       is needed to close it.";
     - the dismiss words the client matched are never shown.
   - `feedback.ts` attaches the list to each listed step, over the final attempt and the attempts it got past.
8. **Domain naming** (new `domain/src/runtime/llm-evidence/way-out-handles/cleared-control-handles.ts`,
   wired in `tools.ts`).
   - For each known reference, the way out is described as a one-element capture
     (`{url, interactiveElements:[element], truncated: true}`) by the same sanitizer.
   - The Flow's stable handles number it, so a later real capture of that page with the notice up gives the
     same number.
   - It is remembered as a cut-short look. That only adds: the handle joins the page, the view history, and
     the printed set.
   - A candidate step naming the handle therefore resolves to that control under `view_history`.
   - `createWebAutomationLlmEvidenceRuntime(sessions, clearedWayOuts?)` takes the registry, and
     `bindWebAutomationLlmEvidenceRuntime` passes the FluxIQ instance's own.
9. **Format** (`flow-bootstrap/plan/flow-script-format.ts`).
   - The loop slow-down rule now asks first for `repeat pace:` of at least the wait.
   - The `optional: yes` dismiss step plus the `only after:` wait are asked for only when the step's
     `interruptions` names a `wayOut`, and the dismiss step must press that handle.
   - "A notice listed with no `wayOut` was closed by the run itself: write no step for it, and never close it
     through any other handle."
   - The state format's handler rule got the same sentence for any interruption.
   - The doc comment records the t470 evidence.
   - The worked example is unchanged: a mail service, not a realistic-scenario shape.

### Part 2: live builds measure the model's own reset

- `packages/test-runner/src/flow-lane/creation/readiness.ts`:
  - `labCandidateTrialFixtureReset({live})` returns `!live`, the one policy.
  - The readiness record gains `fixtureResetBetweenTrials`.
  - Admission becomes: candidate, `trialRunner` true, `fixtureResetBetweenTrials` a boolean, and
    `startReset === fixtureResetBetweenTrials`.
  - A live run whose Core still resets between trials is refused before any provider call with
    `lab.candidate_start_hook_set`, so the receipt never lies.
  - `labCandidateTrialReadiness` takes the policy.
  - `readCreatedFlowCandidateTrialReadiness` takes it as a 4th argument, defaulting to `true`.
- `environment.ts`: new `TopologyPaths.candidateTrialFixtureReset`. When it is false,
  `labCandidateStartHookEnvironment` gives no `FLUXIQ_CANDIDATE_START_URL`/`TOKEN`. Absent means `true`, which
  is today's behaviour.
- `coordinator.ts`: `TopologyOptions.candidateTrialFixtureReset` is passed through.
- `run-scenario.ts`: a live run passes `candidateTrialFixtureReset: false` to the topology and to the
  created-Flow lane. The file stays at 800 lines because the edits sit inside existing lines.
- `flow-lane/creation/lane.ts`: new optional input `candidateTrialFixtureReset`, given to the readiness read.
- `cli.ts`: the dry-run receipt computes `candidateTrial` with the policy.
- **Unchanged:**
  - provider-free paths: recovery matrix, saved-Flow replay, interactive and demo sessions, chat and
    perturbation checks;
  - the fixture's initial seed;
  - the lane's reset before playback.

## Commands run and observed results

- **Core vitest, changed dirs:**
  - Command: `npx vitest run .../service/candidate-trial .../executor/node-execution/tests/cleared-layers.test.ts .../flow-bootstrap/plan`.
  - Result: 327 passed, 1 failed.
  - The failure is `plan/tests/extraction-vocabulary.test.ts`: "expected 3769 to be less than or equal to 3000".
  - It is pre-existing. The same file fails on the untouched `C:/Users/osrs_/FluxStuff/!FluxIQ` at the same
    commit `2aedbc1b`: "1 failed | 4 passed".
- **Core vitest after the last edits:** cleared-layers, loop-format, flow-script-format and candidate-trial:
  "Test Files 14 passed (14)", "Tests 213 passed (213)".
- **Core typecheck:** `npx tsc -p tsconfig.json --noEmit` (packages/fluxiq) gave `core-tsc=0`, with no output.
- **Core build:** `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` gave `build=0`.
- **Domain tests:**
  - Command: `DOMAIN_TEST_BUILD_LABEL=t470 node scripts/test-domain.mjs cleared-way-outs/ way-out-handles/ io/tests/gateway-output-dispatcher actions/tests/cleared client/tests/gateway-mapping llm-evidence/tests/stable-handles llm-evidence/tests/tools`.
  - Result: `# tests 104`, `# pass 104`, `# fail 0`.
  - This includes "a pressed way out is named by a handle of its own, which a candidate step resolves to that
    control". In that test "Close chat" stays t1 and resolves `#chat-close`, and the notice's OK becomes t2
    and resolves `#slow-down-ok`.
- **Extension unit tests:** `EXTENSION_TEST_BUILD_LABEL=t470 node scripts/test-extension.mjs content/action-runtime/interference/tests content/action-runtime/recovery/tests` gave `# tests 127`, `# pass 127`, `# fail 0`.
- **Extension content spec, headed:**
  - Command: `pnpm test:content -- safe-clearing/ --headed --workers=1` (social-network-feed).
  - Result: `3 passed (45.8s)`, rerun after the final edits and the Core rebuild.
  - It asserts that the rate-limit OK record carries `wayOut` with `url` containing `/friends/requests/`, and
    an element with `role: "button"` and `visibleText: "OK"`.
- **Typechecks:** domain src and test, extension src and test, and test-runner `tsc --noEmit` all gave exit 0.
- **Test-runner** (after `test-runner:build`):
  - Command: `node --test dist/.../readiness.test.js dist/tests/environment.test.js .../build-from-chat.test.js .../lane-candidate.test.js .../lane.test.js .../authoring-mode-env.test.js`.
  - Result: 83 tests, 80 passed, 3 failed.
  - All 3 failures are pre-existing and unrelated: "Core's own variable and default...", "every Core the Lab
    starts is given the mode explicitly...", and the t348 hook test.
  - Each fails `expected 'legacy'`, `actual 'candidate'` when no `--authoring-mode` is given. Core's
    `AUTOMATION_STUDIO_AUTHORING_MODE_DEFAULT` is now `"candidate"` (t450), and these tests still expect
    `legacy`. My only edit to `environment.test.ts` is an appended test, which passes.
- **Dry run, provider-free:**
  - Command: `pnpm lab run social-network-feed --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task social-network-feed-confirm-requests --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --authoring-mode candidate --dry-run`.
  - Result: exit 0, `"status":"ready","providerCallCount":0`, and
    `"candidateTrial":{"trialRunner":true,"startReset":false,"fixtureResetBetweenTrials":false,"source":"lab-plan"}`.
- **Structure audits:**
  - Downstream: `structure-audit: passed (186 warning(s), 646 baselined)`.
  - Core: `structure-audit: passed (333 warning(s), 1159 baselined)`.
  - The first runs failed on six findings, all mine: failure-as-empty in three catch blocks, `as never`,
    statement-packing, and `executor/contracts.ts` at 805 lines. All six were fixed:
    - the Core trial no longer swallows a domain error;
    - the domain sanitizer has no catch;
    - the extension keeps one best-effort catch without a return.

## Not verified

- **No live or paid run.** It is not proven that the model, when given `interruptions[].wayOut`, writes the
  dismiss step against it. It is also not proven that a live build's trials pass from its own reset.
- **No end-to-end test passes the real extension descriptor into the domain naming.** The content spec proves
  the descriptor is produced. The domain test proves the naming with a hand-written descriptor of the same
  fields. The real OK is a `div role="button"`, which the snapshot path already describes, but this exact
  chain is not covered by one test.
- **Not exercised:**
  - the Chrome/Edge extension loaded unpacked: the content harness injects the bundle;
  - Firefox;
  - a way out inside a child frame. It is deliberately not reported.
- `dialog-refusal.spec.ts` (modal-flows) had its expectation updated but was not run. modal-flows is not one
  of the ten realistic scenarios.
- No full suites were run, per the twice-a-day rule.

## Open questions or contradictions found

- **Docs need updating, outside my owned paths:**
  - Downstream `docs/architecture/testing-facility.md`, the candidate start hook / D1 section. Live builds now
    get no hook, and there is the new refusal `lab.candidate_start_hook_set`.
  - Core `docs/architecture/automation-studio/client-gateway.md` and `llm-flow-bootstrap.md` and
    `automation-studio.md`: the `clearedLayers[].wayOut` reference, the `clearedControlHandles` binding, and
    the trial feedback's `interruptions`.
- **Files at their length limit:**
  - `executor/contracts.ts`: 800 lines.
  - Downstream `domain/src/runtime/llm-evidence/tools.ts`: 799 lines.
  - `packages/test-runner/src/run-scenario.ts`: 800 lines. It was already at 800.
  - The next edit to any of them needs a split.
  - `service/candidate-trial/` now has 17 files, past the advisory 15.
- **Page bound on naming.** Naming a way out on a page the build never captured adds a page to that Flow's
  packet store, which keeps at most 8 pages, and could push out the oldest page. In practice trial pages are
  pages exploration visited.
- **Stale tests on dev:** `extraction-vocabulary.test.ts` (3769 > 3000 bytes), and the three test-runner
  authoring-mode tests that still expect a `legacy` default.
