# Open questions — MVP Week 1 web automation reliability

Open questions raised while executing the
[MVP Week 1 plan](../mvp-week1-web-automation-reliability-plan.md). Each entry
names what was found, what was deliberately not changed and why, when it was
raised, and who owns it. Resolving one is a ledger entry in the plan, never a
silent deletion. Moved out of the plan on 2026-09-11: the list keeps growing and
the plan sits against its 800-line threshold.

- **Credentials at replay.** A Flow built from a recording cannot recover a
  redacted password (auth-gate W18). Proposed: the manifest declares the
  fixture credential and the Flow lane supplies it as a declared secret,
  never from the recording. Owner: senior supervisor agent, for the Wave 2
  Flow-lane brief.
- **Selector-keyed patch lane vs fingerprint-first doctrine.** Core's
  `validateTargetOverrideEvidence` takes `{selector}`. Week 1 makes the
  extension accept fingerprint-shaped targets; whether the patch lane
  becomes fingerprint-shaped is a Week 2 contract decision. Owner: senior
  supervisor agent, recorded for the Week 2 document.
- **The extension latches idle when Core refuses a recording start.** When Core
  answers `recording.project_required`, the extension clears its pending start,
  so the 750 ms local-start fallback never fires and the recorder stays idle
  until something else restarts it. No retry, and the user sees no reason. Found
  while proving the runner flake (report `w1-recording-start-flake`), where the
  refusal was reproduced deliberately. The runner now avoids triggering it, which
  fixes the test lane but not the product. A real operator whose context goes
  stale hits the same dead end. Belongs with Phase 1.5, the failure taxonomy,
  since the right behaviour is a classified, surfaced failure rather than a
  silent idle. Raised 2026-09-11; owner: senior supervisor agent.
- **One harness spec file is shared by every verb brief and owned by none.**
  `apps/extension/e2e/content/tests/actions.spec.ts` carries a row per action, so
  each Wave 2 verb worker must edit it, yet no brief lists it under Owns. That
  contradicts the rule that briefs are partitioned by file, and concurrent edits
  can silently lose one another. Mitigation for this wave: workers make targeted
  exact-string edits, and the supervisor verifies at integration that every row
  each report claims is actually present, then runs the harness. Before Wave 3 the
  file needs an owner or a split into one spec per verb. Two workers, w2-select and
  w2-keyboard-input, edited it as declared deviations, and its header sentence is
  now half-stale: it still calls select unreliable and mixes clauses from two
  workers. Correct that sentence at integration. Raised 2026-09-11 by
  w2-select; owner: senior supervisor agent.

- **A disabled option is still selectable.** `select.ts` deliberately does not
  gate on actionability, because that capability belongs to w2-click and still
  throws until that brief lands. Once it lands, select must consult it, or a
  disabled option stays selectable and the gate is missing rather than merely
  deferred. Check this at Wave 2 integration rather than assuming the two briefs
  met in the middle. Update: w2-click has since landed, and made
  `checkActionability` scroll the target itself so the hit test matches the
  geometry the click uses, so the capability now exists and this is a concrete
  integration check rather than a conditional one. The same gap covers the
  keyboard verbs: w2-keyboard-input reports that type, clear and keypress do not
  consult the capability either, so a disabled target reports
  `output_not_observed` instead of `ACTION_REJECTED`. Wire all of them, not just
  select.
  Raised 2026-09-11 by w2-select; owner: senior supervisor
  agent.
- **The verb dispatcher does not cover most verbs with its own try block.**
  `content/actions/execute.ts` awaits only the two wait verbs and returns every
  other verb unawaited, so those promises settle after the try block exits and a
  rejection escapes the catch: the content script then never replies and the
  action never completes at all. w2-domain-status established why: Core applies no
  runtime deadline to a web action, and it deliberately kept `timeoutMs` out of
  the effect payload, because a Core timer at the same value would displace the
  structured `timed_out` result the client reports itself. So nothing upstream
  ends a command the content script never answers. Two workers, w2-extract-list
  and w2-check-assert, found the dispatcher hole independently, and the second
  named the four lines: extract-list, upload, dialog and assert. The file header already states this reason for
  the two waits, while also claiming every verb runs inside one try block, which
  is not true of the returned branches. It is masked today only because each verb
  catches internally, which nothing enforces. Fix at Wave 2 integration, when no
  worker is editing the tree: `return await` on every branch, correct the header
  comment, and add a test that a rejecting verb still produces a failure result.
  Found 2026-09-11 by w2-extract-list; owner: senior supervisor agent.
- **The TypeScript compiler crashes under parallel load on this machine.** Twice
  on 2026-09-11 `tsc` died with a Windows access violation (exit 3221225477,
  surfacing as a segmentation fault and exit 139 through the shell): once during
  a benchmark build that overlapped another Lab run, and once during a worker
  `check` while twelve workers shared the tree. Both succeeded on a rerun with no
  code change. Treat a compiler crash during a parallel wave as environmental and
  rerun once before investigating it as a code error, which is what the wave
  concurrency notes already say about foreign failures. Not investigated further:
  it has never reproduced on a quiet machine, so there is nothing to fix in this
  repository, but it costs time whenever it is mistaken for a real failure.
  Raised 2026-09-11; owner: senior supervisor agent.
- **No end-to-end spec is type-checked.** `pnpm check` in `apps/extension` runs
  `tsc` over `src/**` through two configs, and neither covers `e2e/**`, so none of
  the thirteen Wave 2 harness specs is type-checked at all. A spec can reference a
  field that does not exist and still ship, which is exactly the kind of standard
  that should fail a build rather than rely on review. Fix at Wave 2 integration,
  when the tree is still: add `e2e/**/*.ts` to the shared `tsconfig.test.json`,
  then fix or assign whatever errors surface. Deliberately not done during the
  wave: it changes what `check` reports for every running worker mid-gate and
  could fail them on specs they are still writing. Found 2026-09-11 by w2-waits;
  owner: senior supervisor agent.

- **Settled: whether `timed_out` survives the domain hop.**
  w2-domain-status reports that `domain/src/runtime/adapter.ts` no longer flattens
  `timed_out` and `cancelled`, with tests; w2-waits reports that it still
  flattens, so a timeout is proven only at the content-harness boundary. One
  observation is stale, most likely the second, taken before the first landed in a
  shared tree. Settled 2026-09-11 by reading the file. `adapter.ts` passes the status through,
  `status: result.status ?? (result.ok ? "succeeded" : "failed")`, and its comment
  states that `timed_out` and `cancelled` reach Core as themselves so
  `failureForCommandStatus` can classify them. w2-domain-status was right; the two
  later reports were stale readings of a tree that had moved. A second
  disagreement settled the same way: the `downloads` permission is present in all
  three manifests, as w2-upload-dialog reported and w2-browser-actions denied. The
  lesson for every parallel wave: a worker report about a file it does not own is
  a snapshot, not a fact, and the supervisor settles it by reading rather than by
  preferring a source. Record the resolution in the plan ledger at integration.
  Raised and settled 2026-09-11; owner: senior supervisor agent.
- **The gateway mapping never lifts the new action parameters, and no brief owns
  it.** `domain/src/client/gateway-mapping.ts` does not carry the Wave 2
  parameters (`checked`, the assert fields, the tab fields, and the rest) onto the
  command, so the seven new actions cannot be driven end to end even though their
  types, schemas, nodes and manifest outputs all exist. No Wave 2 brief lists that
  file under Owns, so this is a gap in the wave rather than a defect in any
  worker. Fix at integration or brief it explicitly in Wave 3; it is the last link
  between the vocabulary and a real Core-driven run. Found 2026-09-11 by
  w2-domain-vocabulary; owner: senior supervisor agent.

- **The Firefox floor predates the main-world dialog override.** The dialog verb
  overrides the page dialogs from the main world, which needs Chrome 111 or
  Firefox 128, while `manifest.firefox.json` declares `strict_min_version`
  109.0. On an older Firefox the override detects the wrong world and the verb
  fails honestly rather than silently, so nothing is unsafe. Raising the floor
  changes which browsers the product supports, which is the user decision, not the
  agent one. Not changed. Raised 2026-09-11 by w2-upload-dialog; owner: the user,
  to decide.

- **The recorder never reports a checkbox checked state.** `content/
  describe-element.ts` omits it, so a recorded checkbox toggle carries no state
  and the mapping to `web.dom.check` deliberately stays evidence rather than
  replaying a guess; the previous behaviour typed the string on into checkboxes.
  A radio still maps deterministically. Closing this needs the recorder to report
  the state. Found 2026-09-11 by w2-domain-vocabulary; owner: senior supervisor
  agent.
- **Settled: the domain target accessible-name field.**
  `domain/src/output-nodes/targets.ts` reads `descriptor.name`, which still means
  the authored `name` attribute, while w2-identity-capture added a dedicated
  `accessibleName` field computed the way the Core fingerprint normalizer expects.
  Settled 2026-09-11 by reading the file: no change was needed. `targets.ts`
  already takes `accessibleName` from the dedicated field, falling back to
  `aria-label`, and keeps `name` as the authored attribute in its own field.
  w2-domain-vocabulary had landed it before this was raised, and
  w2-identity-capture read an earlier state of a tree that was still moving. That
  is the fourth cross-file report settled by reading rather than by acting on it,
  which is now a pattern worth trusting: in a parallel wave, verify before you fix.
  Raised and settled 2026-09-11; owner: senior supervisor agent.

- **Landmark context carries a role but no name.** `context.landmark` records the
  landmark role only, so the two named regions in the `ambiguous-targets` fixture
  produce identical context, which a test now pins. Corpus workflow W26 resolves
  ambiguity by context and will need either the landmark name or an xpath or
  bounds fallback before it can pass. Not changed: the shape is a Phase 1.3
  decision and W26 is a Wave 4 workflow. Found 2026-09-11 by w2-identity-capture;
  owner: senior supervisor agent.
- **Two page-scheme lists now exist.** `background/connection/browser-state.ts`
  decides which pages cannot be recorded, and w2-browser-actions added
  `runtime/unsupported-page.ts` for the same question on the action path. The
  older one misses `about:`, `view-source:` and `data:` and the current store
  hosts, so the two disagree. Point the background one at the newer module rather
  than maintaining two lists; the file is unowned by any Wave 2 brief. Found
  2026-09-11 by w2-browser-actions; owner: senior supervisor agent.

- **The capabilities page understates what the code now does.**
  `docs/architecture/web-capabilities.md` rows 84 and 97 to 100 describe the
  pre-Wave-2 behaviour of the browser actions. Updating it is Phase 1.2 step 6 and
  was outside every Wave 2 brief, so it falls to integration or Wave 3. The
  repository rule is that authored documentation is updated in the same work as
  the change, so this is already overdue rather than optional. Found 2026-09-11 by
  w2-browser-actions; owner: senior supervisor agent.
- **A recorded action can be silently dropped from the proposed Flow.** In one
  `basic-form` run of four, the click was recorded (`web.element.clicked`, one
  event) but only four of five candidates were proposed, so the Flow lost the
  action without reporting anything. The rerun passed. This is the most serious
  finding of Wave 2, because the whole week rests on a recording becoming a
  faithful Flow: a silent loss is worse than a failure, which at least announces
  itself. Not diagnosed: it appeared once, in a lane built for something else.
  Reproduce it deliberately before Wave 5 measures reliability, or the benchmark
  measures a number it cannot explain. Found 2026-09-11 by w2-flow-lane; owner:
  senior supervisor agent.

- **The expired auth-gate workflow cannot report `auth_required` yet.** W19 runs
  its Flow and every action succeeds, so no structured failure is produced and the
  lane fails honestly against the manifest expectation. The cause is upstream of
  the lane: the recorded Flow has no step requesting `/account`, because the
  mapper excludes the client-side `location.assign` that navigates there. Closing
  it needs either `web.dom.assert` or the expectation evaluator of decision D10
  and Core contract C3. The worker deliberately did not weaken the assertion to
  make the run pass, which was the right call. Found 2026-09-11 by w2-flow-lane;
  owner: senior supervisor agent.

- **A routine command deletes tracked build artifacts.** `pnpm lab` chains
  `pnpm build`, which removes and rewrites the eight tracked files under
  `apps/extension/build/`. That is why no parallel worker may run it, and why the
  flow lane drove the runner CLI directly instead. A command that deletes tracked
  files as a side effect is a trap for anyone who runs it casually. Either the
  artifacts should not be tracked, or the Lab should not chain a build. Raised
  2026-09-11 by w2-flow-lane; owner: senior supervisor agent.

- **The action type must be joined through the node, and one lane gets it wrong.**
  Core records every recorded action as `builtin.policy.action`, so a lane
  checking which action ran must join through `nodeId` to the graph Flow
  `parameterValues.outputId`. The new Flow lane does this;
  `existing-flow-run.ts` still compares `definitionId` to the expected action, so
  it can only ever match by accident. It is unowned by any Wave 2 brief and
  untested against a real existing target here. Found 2026-09-11 by w2-flow-lane;
  owner: senior supervisor agent.
- **Two dependency members are dead weight.** `ContentActionDependencies` still
  declares `waitForElement` and `waitForText` (`content/actions/types.ts`, lines
  41 and 42), and `content/action-runtime/execute-action.ts` imports both from
  `./waits` and wires them into the dependency object, but no verb calls either:
  the wait verbs now use the wait-conditions module instead. Verified 2026-09-11
  by searching `src` and `e2e`, where the only other matches are
  `waitForTextAction`, the verb, a different symbol sharing a prefix. Removing
  them touches those two files and leaves the implementations in `waits.ts`
  exported but unused. Held during Wave 2 integration only because three workers
  were type-checking against that type at the time; do it on a still tree. Found
  2026-09-11 by w2-waits; owner: senior supervisor agent.
- **Settled: the node join in the run manifest.** `flowActionTimings` in
  `packages/test-runner/src/run-manifest/action-timings.ts` still reads
  `definitionId`, while `run.json` records `builtin.policy.action` for every
  recorded action, so its action types are wrong for the same reason
  `existing-flow-run.ts` was. Fixed 2026-09-11 with the same join through `nodeId`
  to the graph Flow `parameterValues.outputId`. Two lessons came with it. The
  reader cannot move into `action-timings.ts`, because that would close a
  run-manifest to flow-lane import cycle the audit forbids, so the map is passed
  in by the caller exactly as the Flow lane already does. And the fix landed
  inert: the brief owned the file but not its call site, so nothing passed the
  map and `run.json` still recorded `builtin.policy.action`. The supervisor wired
  it through `ExistingFlowExecution` and both call sites in `run-scenario.ts`,
  reusing the map that is already read when expectations exist, so a run without
  expectations makes no extra Automation Studio call and keeps the old fallback.
  A test now asserts the returned map, because an untested wiring is how this
  stayed inert. That was the fifth defective brief of the week, all the same
  shape: ownership drawn around a file rather than around the change.

- **Eight URL classes are no longer recordable.** Pointing the background
  page-scheme check at the shared rule refuses eight classes of URL that the
  recording path previously accepted, including `about:`, `view-source:` and
  `data:` pages and the current store hosts. That is the intended direction, since
  the two lists disagreed and the shared one is correct, but it is a real
  behaviour change for anyone who recorded on those pages. The user-facing wording
  still says recorded rather than automated, deliberately. Note it in the
  extension client page when the capabilities page is updated. Found 2026-09-11 by
  w2i-unowned-defects; owner: senior supervisor agent.

- **The shared action-type reader adds calls to existing and clone runs.** Reusing
  `readFlowActionTypes` in `existing-flow-run.ts` brings its `recording.contract`
  throw and two extra Automation Studio calls to any existing or clone run that
  asserts actions. Neither target can be exercised on this machine, so the cost
  and the throw are unmeasured against a real server. Check both before Wave 4
  leans on those targets. Found 2026-09-11 by w2i-unowned-defects; owner: senior
  supervisor agent.
- **An unusable parameter has no rejection channel.** The domain now lifts every
  Wave 2 parameter onto the command and refuses malformed values rather than
  coercing them, which is right. But a valid action type carrying an unusable
  parameter has nowhere to say so: a refused upload reaches the page as a command
  with no files, and the content script can only report that the command carried
  no files. The operator sees a symptom, not the cause. An unknown action type
  already has a rejection path, added in Wave 1, so the shape exists to copy.
  Belongs with Phase 1.5, the failure taxonomy, where a refusal should be a
  classified failure rather than an empty command. Found 2026-09-11 by
  w2i-gateway-params; owner: senior supervisor agent.
