# Wave 3 worker briefs

Briefs for Wave 3 of the
[MVP Week 1 plan](../../mvp-week1-web-automation-reliability-plan.md)
(Sequencing: Phase 1.3 steps 3–6, Phase 1.4 steps 1–6, Phase 1.5 steps 3–5),
written by the senior supervisor agent after Wave 2 was integrated and pushed.
`w3-failure-codes` runs alone first; the rest run in parallel once it lands.
Workers read only their own brief.

Every worker also reads the plan's `Current State`. Paths are relative to
`F:\!FluxIQWebExtension`; report paths are under
`docs/working/mvp-week1-web-automation-reliability-plan/reports/`.

## Verified before this wave was written

Do not redo these. Each was checked by reading the code at Wave 3 planning,
because several Wave 2 briefs described work that already existed.

- **Phase 1.3 steps 1 and 2 are done.** `describe-element.ts` derives `testId`,
  `accessibleName`, `label`, `implicitRole`, `context`, `href` and `inputType`;
  `content/identity/` holds the accessible-name, label, implicit-role, context
  and bounded-text modules; the attribute allowlist already carries
  `aria-labelledby`, `aria-describedby` and `for`. Wave 3 starts at step 3.
- **Phase 1.5 step 2 is done.** Core carries all seven adaptive failure classes
  and both target comparison statuses, and classifies structured-first, so the
  timeout-classification defect is already fixed.
- **Phase 1.5 step 1 is done.** The paired Core document exists and owns the
  contracts; the Core seam is briefed there as `core-expectation-evaluator`.

## Binding rules for every worker

Carried from Wave 1 and 2, where each of these cost real time.

- Set `EXTENSION_TEST_BUILD_LABEL=<your brief name>` and, if you run domain
  tests, `DOMAIN_TEST_BUILD_LABEL=<your brief name>`. Without them parallel runs
  overwrite each other.
- Do **not** run `pnpm build`: it deletes `dist/` and rewrites the tracked
  `build/` directory, so parallel runs race and one crashed a compiler. The
  supervisor runs it once at integration.
- Do **not** run any `pnpm lab` command unless your brief says you own the Lab.
  Only one Lab run may execute on this machine at a time.
- Capture a command's exit status by redirecting to a file and echoing `$?`,
  never through a pipe: a pipe reports the last command's status, which hid a
  real failing suite for part of a day.
- Write files with the Write or Edit tool, never a Bash heredoc: the Bash tool
  collapses `\\` to `\`, and a command over about 8 KB fails with a misleading
  quote error.
- The structure audit reads only git-tracked files. Audit new files through a
  scratch `GIT_INDEX_FILE`, and never run `pnpm structure:baseline`.
- The baseline only lowers or removes entries and refuses growth. Do not grow a
  baselined file, explanatory comments included.
- The content harness builds into a directory unique to each run, so parallel
  `pnpm --filter @fluxiq-web-extension/extension test:content` runs are safe.
- Other workers edit this tree at the same time. A failure in a file you do not
  own is most likely a parallel edit: rerun once before reporting it. A
  compiler crash under load is environmental; rerun once.
- Edit only the files your brief lists under Owns. If your brief makes that
  impossible, say so and stop rather than widening silently. Five Wave 2 briefs
  were defective that way and the supervisor wants to know.
- Watch for the commonest of those defects: ownership drawn around a file rather
  than around the change. If your fix needs a caller you do not own to pass
  something, or a barrel you do not own to export it, the change lands inert and
  every gate still passes. Report that instead of shipping something nothing
  invokes, and say which file the brief should have included.

## Failure vocabulary

Categories are Core's enum values, used exactly. A disabled, hidden or covered
target is `ACTION_REJECTED`; a target that cannot be found is
`TARGET_NOT_FOUND`; several matching candidates is `TARGET_AMBIGUOUS`; an action
that ran whose post-condition did not hold is `OUTPUT_NOT_OBSERVED` with
`expected` and `actual`; an authored assertion that does not hold is
`STATE_MISMATCH`; a landed URL other than the requested one is
`NAVIGATION_UNEXPECTED`; a wait or action timeout is status `timed_out` with
`TIMEOUT`.

## Serial first

### Brief: w3-failure-codes
- Task: Phase 1.5 step 3, the shared half. Create
  `domain/src/runtime/failure/{codes,classify}.ts`: a closed set of failure
  codes, and a classifier mapping a `WebAutomationRuntimeError` and an action
  outcome onto a Core category plus one of those codes. Four other briefs cite
  this set, so it must be complete and exact before they start. Cover every
  category in the vocabulary above, plus `PAGE_CHANGED` for a document identity
  that changed between dispatch and execution, `AUTH_REQUIRED`,
  `USER_INTERVENTION_REQUIRED`, and `UNKNOWN`.
- Owns (may edit): `domain/src/runtime/failure/` and its `tests/`.
- Must not touch: anything else.
- Definition of done: domain `check` and `test`; every code covered by a test;
  the report lists the full code set, because the other briefs quote it.
- Report to: `reports/w3-failure-codes.md`

## Parallel after w3-failure-codes

Every brief below: read `reports/w3-failure-codes.md` for the code set you
emit. Definition of done also includes extension `check`, `test`,
`test:content` where you touch content code, domain `check` and `test` where you
touch domain code, and a clean structure audit.

### Brief: w3-resolver
- Task: Phase 1.3 step 3. `content/action-runtime/resolve-target.ts` is 52 lines
  and does exact lookup only. Add Level 1 and Level 2: exact strategies gate on
  visibility, enabled state and tag agreement and count their matches; on zero
  or several exact matches, enumerate candidates (same tag or role family, one
  frame, capped) in a new `content/identity/candidates.ts` and score them with
  Core's matcher in a new `content/identity/score.ts`. Return the best candidate
  when its score clears the floor and beats the runner-up by a margin; otherwise
  fail `TARGET_AMBIGUOUS` carrying the top candidates, or `TARGET_NOT_FOUND`
  carrying the strategies attempted. Confidence is the measured score, never a
  constant. `wait_for_selector` uses the same resolver. A visual point prefers
  scroll-corrected `documentBounds`.
- Owns (may edit): `content/action-runtime/resolve-target.ts`; new
  `content/identity/{candidates,score}.ts` and the identity barrel; new
  `e2e/content/tests/identity-resolution.spec.ts`.
- Must not touch: other verbs, `describe-element.ts`, `element-traits.ts`.
- Definition of done: as above, plus spec rows on the `identity-drift` fixture
  for each mode (`selector-only`, `text-only`, `moved`, `wrapped`,
  `aria-variant`) resolving to the intended control above the floor, and
  `ambiguous-targets` returning `TARGET_AMBIGUOUS` without context.
- Report to: `reports/w3-resolver.md`

### Brief: w3-domain-contracts
- Task: Phase 1.3 steps 4 and 5 on the domain side, plus Phase 1.4 step 5. These
  share files, so they are one brief. Carry `browserFrameId` through the target
  payload and map it to `action.frameId` (`gateway-mapping.ts`, `payloads.ts`).
  Make the fingerprint survive adaptation: `gateway-mapping.ts` already reads
  `target.element` and `target.fingerprint`; web output nodes must declare
  `metadata.elementTarget: true` and a `safety.level` so Core's floor applies
  (`definitions.ts`). Write `web.dom.assert` conditions into
  `parameterValues.expectedState` so Core's transition comparison has something
  to evaluate, and remove the declared-but-unproduced `elements.*.<field>`
  paths, since the JSON blob is what consumers read
  (`definitions.ts`, `payloads.ts`, `domain/src/recording/domain.ts`).
- Owns (may edit): `domain/src/client/gateway-mapping.ts`,
  `domain/src/output-nodes/{definitions,payloads}.ts`,
  `domain/src/recording/domain.ts`, and tests beside each.
- Must not touch: `domain/src/runtime/`, `domain/src/recording/web-state.ts`,
  `apps/`.
- Report to: `reports/w3-domain-contracts.md`

### Brief: w3-frame-plumbing
- Task: Phase 1.3 step 4 on the extension side. A command addressed to a child
  frame must reach that frame: `runtime/action-runner.ts` routes by
  `action.frameId`, and `content/message-handler.ts` accepts an addressed
  command. Shadow DOM stays out of scope, recorded but not replayable.
- Owns (may edit): `apps/extension/src/runtime/action-runner.ts`,
  `apps/extension/src/content/message-handler.ts`, tests beside each, and a
  cross-frame row in a new `e2e/content/tests/frames.spec.ts`.
- Must not touch: `result-mapping.ts`, the verbs, `domain/`.
- Report to: `reports/w3-frame-plumbing.md`

### Brief: w3-redaction
- Task: Phase 1.4 step 1, and it is a security fix, so write the proof first. A
  sensitive control must never yield a value on any path:
  `content/describe-element.ts` `readElementValue`, `content/dom-events.ts`, and
  `capture-settings.ts`. The sensitivity rule is one shared function,
  `isSensitiveFieldSignature` in `shared/sensitive-field.ts`; use it rather than
  writing a second rule, since a duplicated rule already leaked a billing card
  number. Document the `inputValues` default, and make the file header true.
- Owns (may edit): `content/describe-element.ts`, `content/dom-events.ts`,
  `content/capture-settings.ts`, their tests, and
  `e2e/content/tests/redaction.spec.ts`.
- Must not touch: `shared/sensitive-field.ts`, `dom-snapshot.ts`, `identity/`.
- Definition of done: as above, plus a spec asserting no password value appears
  in any captured message on the `sensitive-input` fixture.
- Report to: `reports/w3-redaction.md`

### Brief: w3-evidence
- Task: Phase 1.4 steps 2 and 3 on the extension side; they share
  `dom-snapshot.ts`, so they are one brief. Add the absent evidence items as new
  modules under `content/evidence/`: dialogs and modals (`<dialog>`,
  `role=dialog`, `aria-modal`, and the pending native-dialog flag), blocking
  overlays (occlusion hit-test of interactive candidates, reporting the top-most
  blocker), loading state (`readyState`, `aria-busy`, spinner heuristics,
  pending navigation), landmarks and regions, and repeating-structure detection
  with an item count and a representative item. Wire them into
  `dom-snapshot.ts`. Then the partial items: a forms model grouping controls by
  form, `recentlyInteracted` and `changed` as runtime fields diffed against the
  previous snapshot rather than recording-only, navigation state in the
  snapshot, and `truncated` with pre-filter totals.
- Owns (may edit): new `content/evidence/`, `content/dom-snapshot.ts`,
  `content/types.ts`, `apps/extension/src/runtime/result-mapping.ts`, tests
  beside each, and `e2e/content/tests/evidence.spec.ts`.
- Must not touch: `domain/src/recording/web-state.ts` (w3-state-identity owns
  it), `describe-element.ts`, `dom-events.ts`.
- Definition of done: as above, plus a table spec asserting each item on
  `modal-flows`, `infinite-feed`, `product-catalog` and `intermediate-state`.
- Report to: `reports/w3-evidence.md`

### Brief: w3-state-identity
- Task: Phase 1.3 step 6 and the recording-state half of Phase 1.4 step 3.
  `domain/src/recording/web-state.ts` is 644 lines, past the 400-line advisory,
  and the baseline refuses growth, so split it by responsibility first and then
  make the change. `elementStateId` must disambiguate a shared `data-testid` or
  `id` with a positional suffix instead of collapsing them; `filterStateElements`
  must report the pre-filter total in `elements.count` and set a `truncated`
  flag.
- Owns (may edit): `domain/src/recording/web-state.ts`, the modules you split it
  into, and tests beside them.
- Must not touch: `domain/src/recording/domain.ts`, `domain/src/output-nodes/`,
  `apps/`.
- Report to: `reports/w3-state-identity.md`

### Brief: w3-llm-packet
- Task: Phase 1.4 step 4. `domain/src/runtime/llm-evidence.ts` is 449 lines,
  past the advisory threshold, and the baseline refuses growth, so split it into
  `llm-evidence/{sanitize,elements,location,limits}.ts` first. Then expose the
  new evidence items compactly; set the default byte budget to align with Core's
  3,000-byte failure-evidence gate on the failure path and 6,000 for
  exploration, both under the 12,000 ceiling; make frame coverage match the
  state pipeline; and carry `selectedText` and focus.
- Owns (may edit): `domain/src/runtime/llm-evidence.ts`, the modules you split
  it into, and tests beside them.
- Must not touch: `domain/src/runtime/adapter.ts`,
  `domain/src/runtime/failure/`, `apps/`.
- Definition of done: as above, plus a test asserting `truncated` and the
  element count at the budget boundary.
- Report to: `reports/w3-llm-packet.md`

### Brief: w3-host-runtime
- Task: Phase 1.4 step 6. Core's `AutomationStudioHostRuntimeBoundary` has
  capture points `before_action`, `after_action`, `after_wait_retry` and
  `after_patch_test` that populate `attempt.stateRefs` and enable
  `inspectStateDiff`, and nothing downstream binds it, so no web attempt carries
  state refs. Create `domain/src/runtime/host-runtime.ts` and bind it beside
  `bindRuntimeService`, sourcing snapshots through `web.dom.capture_snapshot`.
  Bound it by the same byte budget as the sanitized packet.
- Owns (may edit): new `domain/src/runtime/host-runtime.ts`, its tests, and the
  one binding line beside `bindRuntimeService`.
- Must not touch: `llm-evidence.ts`, `adapter.ts`, `failure/`, `apps/`.
- Report to: `reports/w3-host-runtime.md`

### Brief: w3-failure-producers
- Task: Phase 1.5 step 3, the producer half, and step 4. Every browser failure
  must carry the structured field, using the codes from `w3-failure-codes`:
  `content/action-runtime/results.ts` for validation outcomes with `expected`
  and `actual`, and `domain/src/runtime/adapter.ts` for the domain hop. Then
  step 4: a failed result attaches a sanitized `web-llm-evidence.v1` packet
  captured at the instant of failure, bounded to Core's gate, with the URL and
  target diagnostics riding with it.
- Owns (may edit): `content/action-runtime/results.ts`,
  `domain/src/runtime/adapter.ts`, tests beside each, and
  `e2e/content/tests/failures.spec.ts`.
- Must not touch: `resolve-target.ts` (w3-resolver emits its own target
  failures), `action-runner.ts` (w3-frame-plumbing owns it),
  `domain/src/runtime/failure/` (w3-failure-codes owns it), `llm-evidence*`.
- Definition of done: as above, plus spec rows planting each category on
  `failure-surfaces`, `auth-gate`, `intermediate-state` and `navigation`.
- Report to: `reports/w3-failure-producers.md`

### Brief: w3-runner-alignment
- Task: Phase 1.5 step 5. The test runner keeps its own failure vocabulary,
  which will drift from the domain's. Generate the allowlist in
  `packages/test-runner/src/demo-llm-create-ui.ts` from the domain codes, and
  remove `runnerFailureCategories` and the dead list in `failure.ts`, and align
  the coercion in `bench/evaluate-run.ts`, which today maps anything outside
  `failureCategories` from `@fluxiq-web-extension/test-contracts` to `unknown`.
  Verified at planning: there is no `evaluation.ts`. The plan named a file that
  does not exist, and the plan text has been corrected too.
- Owns (may edit): `packages/test-runner/src/demo-llm-create-ui.ts`,
  `packages/test-runner/src/failure.ts`,
  `packages/test-runner/src/bench/evaluate-run.ts`, and tests beside them.
- Must not touch: `run-scenario.ts`, the flow-lane modules, `run-manifest/`.
- Definition of done: test-runner `check` and `test`; a test proving the
  allowlist derives from the domain set rather than repeating it.
- Report to: `reports/w3-runner-alignment.md`
