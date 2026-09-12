# Open questions — MVP Week 1 web automation reliability

Open questions raised while executing the
[MVP Week 1 plan](../mvp-week1-web-automation-reliability-plan.md). Each entry
names what was found, what was deliberately not changed and why, when it was
raised, and who owns it. Resolving one is a ledger entry in the plan, never a
silent deletion. Moved out of the plan on 2026-09-11: the list keeps growing and
the plan sits against its 800-line threshold.

**Every entry carries a status tag, audited 2026-09-12 by v-openq-audit against
the tree at `11d2ed3`.** Read the tag first; the original text below it is kept
verbatim as the record of what was believed when it was raised, and the closing
paragraph says what was read to settle or correct it.

| Tag | Means |
| --- | --- |
| `[SETTLED …]` | Closed. The closing paragraph names the file and line that proves it. Do not brief work from a settled entry. |
| `[OPEN]` | Live and accurately described. Brief it as written. |
| `[OPEN — description corrected …]` | Live, but part of what it says is no longer true. **Read the correction before briefing it**; the original text alone will send a worker at the wrong files. |
| `[PARTLY SETTLED …]` | Some sub-items closed, some live. The closing paragraph splits them. |
| `[SUPERSEDED …]` | Duplicated by another entry; merge at the next compaction. |

Why the tags exist: on 2026-09-12 two entries here described work that
`ed6ab74` had already done and were never marked, and a worker was dispatched
to redo one of them. An unmarked open question is indistinguishable from a live
one and costs a whole worker. Mark an entry in the same unit of work that
settles it. A worker's report is not evidence that an entry is closed — read the
code; three entries audited on 2026-09-12 were settled by commits whose own
reports had claimed something narrower or wider than what the tree actually did.

- [OPEN — description corrected 2026-09-12] **Credentials at replay.** A Flow built from a recording cannot recover a
  redacted password (auth-gate W18). Proposed: the manifest declares the
  fixture credential and the Flow lane supplies it as a declared secret,
  never from the recording. Owner: senior supervisor agent, for the Wave 2
  Flow-lane brief.
  **Corrected 2026-09-12 by v-openq-audit.** The mechanism landed; the adoption
  did not. `packages/test-runner/src/flow-lane/declared-secrets.ts` resolves a
  scenario's declared secrets from `FLUXIQ_TEST_SECRET_<ID>` and fails the run
  closed when one is unset; `run-flow-lane.ts:79` merges them into the Flow run's
  inputs; `packages/test-contracts/src/scenario.ts:158` declares `secrets` on the
  manifest contract and `validation.ts:235` validates it. But **no scenario
  declares one**: a grep for `secrets:` across every manifest returns nothing, and
  `auth-gate/manifest.ts:19-20` still carries `authGateDemoCredentials.password`
  as a literal recording-script value. So the replay path is built, tested in
  isolation (`flow-lane/tests/declared-secrets.test.ts`) and exercised by no
  scenario — the same inert-wiring shape as the run-manifest join. What is left is
  one manifest edit plus the environment variable, not a design decision.
- [OPEN] **Selector-keyed patch lane vs fingerprint-first doctrine.** Core's
  `validateTargetOverrideEvidence` takes `{selector}`. Week 1 makes the
  extension accept fingerprint-shaped targets; whether the patch lane
  becomes fingerprint-shaped is a Week 2 contract decision. Owner: senior
  supervisor agent, recorded for the Week 2 document.
  **Verified still open 2026-09-12:** `domain/src/runtime/llm-evidence/tools.ts:89`
  still declares `validateTargetOverrideEvidence(evidence, target: { selector:
  string }, failedAction)`. Unchanged by Waves 2 and 3; still the Week 2 contract
  decision it was raised as.
- [OPEN — description corrected 2026-09-12] **The extension latches idle when Core refuses a recording start.** When Core
  answers `recording.project_required`, the extension clears its pending start,
  so the 750 ms local-start fallback never fires and the recorder stays idle
  until something else restarts it. No retry, and the user sees no reason. Found
  while proving the runner flake (report `w1-recording-start-flake`), where the
  refusal was reproduced deliberately. The runner now avoids triggering it, which
  fixes the test lane but not the product. A real operator whose context goes
  stale hits the same dead end. Belongs with Phase 1.5, the failure taxonomy,
  since the right behaviour is a classified, surfaced failure rather than a
  silent idle. Raised 2026-09-11; owner: senior supervisor agent.
  **Corrected 2026-09-12 by v-openq-audit.** "The user sees no reason" is no longer
  true, and that was half the entry. `connection.ts:588`
  `handleRecordingProjectRequired` now writes a `RecordingBlockState` — `{ code:
  "recording.project_required", title: "Project Required", message: … }`
  (`connection.ts:597-601`) — sets `lastError`, and adds a warning activity;
  `shared/protocol.ts:146` carries it on the status and `popup/index.ts:454`
  renders it. Both surfaces get it: `sidepanel/index.ts` is the single line
  `import "../popup/index";`.
  What is still true, and is the whole remaining question: `clearPendingRecording
  Start()` at `connection.ts:589` still cancels the 750 ms local-start fallback
  (`RECORDING_START_ACCEPT_TIMEOUT_MS`, line 83), there is no retry, and the block
  is a bespoke UI state rather than a classified failure from the Phase 1.5 set.
  Rescope this to "no retry, and the refusal is not a classified failure".
- [PARTLY SETTLED — the stale sentence is fixed; the ownership is not] **One harness spec file is shared by every verb brief and owned by none.**
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
  **Audited 2026-09-12 by v-openq-audit.** Two of the three asks are done. The
  half-stale header sentence was corrected: `e2e/content/tests/actions.spec.ts:11-18`
  now reads as one coherent statement ("a select asked for an option it does not
  have changes nothing and reports `output_not_observed`"), with no "unreliable"
  claim left. And the per-verb split happened — the directory holds 18 spec files,
  one per verb area, and the header says this file keeps "one row per action type,
  so a verb that breaks outright is caught here".
  Not done: the file still exists (211 lines), is still touched by any brief that
  adds an action type, and is still listed under no brief's Owns. Give it an owner
  or accept it as supervisor-only.

- [SETTLED 2026-09-12] **A disabled option is still selectable.** `select.ts` deliberately does not
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
  **Settled — verified by reading the code, not the reports.** All four verbs
  consult the capability: `select.ts:52`, `type.ts:37`, `clear.ts:29`,
  `keypress.ts:33` each call `deps.checkActionability(element)` and return
  `deps.rejected(...)` when it refuses. The disabled *option* — the case this entry
  is named for — is refused separately at `select.ts:81-90` on
  `option.matches(":disabled")`, deliberately not through the capability, because
  an option in a closed select has no box to hit-test and would be refused as
  `hidden` for the wrong reason; it reports the same `disabled` code so one
  vocabulary reaches the caller (`select.ts:22-28`). Landed in `ed6ab74`.
  `check.ts` reaches the same outcome by a different route — `deps.setCheckedState`
  returns a `disabled` outcome that `check.ts:30-32` turns into ACTION_REJECTED —
  which is correct but worth knowing is not the shared gate.
- [SETTLED 2026-09-12 — and the branch list in this entry was wrong] **The verb dispatcher does not cover most verbs with its own try block.**
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
  **Settled — verified by reading `content/actions/execute.ts`.** Every one of the
  fifteen branches is now `return await` (lines 55-99), and the header comment was
  rewritten to match (lines 7-25). `content/actions/tests/execute.test.ts` exists
  and, per that header, drives a verb into an asynchronous rejection so a branch
  that loses its `await` fails. Landed in `ed6ab74`, whose message says so.
  **The entry named the wrong lines, which is worth recording.** It said
  w2-check-assert "named the four lines: extract-list, upload, dialog and assert".
  `upload` and `dialog` are synchronous and never had the defect; `scroll` is
  asynchronous and did, and was missed. `execute.ts:19-22` now records the correct
  set: "of the branches that were returned, all but three were synchronous verbs …
  and the three asynchronous ones -- assert, extract-list and scroll". A half-true
  entry is how a worker gets sent at the wrong files.
- [OPEN — environmental, standing] **The TypeScript compiler crashes under parallel load on this machine.** Twice
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
  **Verified 2026-09-12: nothing to read, nothing to fix here.** No code state can
  confirm or refute this. Keep it as standing operational guidance beside the two
  other environmental entries (the content harness under default Playwright
  concurrency, below, and Core's native SQLite).
- [SETTLED — confirmed 2026-09-12] **No end-to-end spec is type-checked.** `pnpm check` in `apps/extension` runs
  `tsc` over `src/**` through two configs, and neither covers `e2e/**`, so none of
  the thirteen Wave 2 harness specs is type-checked at all. A spec can reference a
  field that does not exist and still ship, which is exactly the kind of standard
  that should fail a build rather than rely on review. Fix at Wave 2 integration,
  when the tree is still: add `e2e/**/*.ts` to the shared `tsconfig.test.json`,
  then fix or assign whatever errors surface. Deliberately not done during the
  wave: it changes what `check` reports for every running worker mid-gate and
  could fail them on specs they are still writing. Found 2026-09-11 by w2-waits;
  owner: senior supervisor agent.
  **Settled — and it was already settled when this entry was last read.**
  `e2e/**/*.ts` has been in `apps/extension/tsconfig.test.json` since `ed6ab74`
  (Wave 2 integration), whose commit message says so explicitly. The entry was
  never marked, so on 2026-09-12 the supervisor briefed a worker to do work that
  was already done. Mark an entry settled in the same unit that settles it; an
  unmarked open question is indistinguishable from an open one and costs a whole
  worker.
  That worker did the more useful thing with the time: rather than accept a green
  check as proof, it falsified the gate — injecting reads of three nonexistent
  fields off `BrowserActionResult`, `DomSnapshot` and `RecordingEventPayload`, and
  confirming `tsc` rejected all three before reverting. Twenty-two specs, zero
  errors, and the zero is now known to be real rather than vacuous. It also closed
  a genuine hole: `SentMessage` in `e2e/content/harness.ts` carried an index
  signature (`& Record<string, unknown>`), which types every misspelled field as
  `unknown` instead of rejecting it, so `message.payloadd` would have compiled.
  **Re-verified 2026-09-12 by v-openq-audit, by reading the file rather than the
  report.** `apps/extension/tsconfig.test.json` reads `"include": ["src/**/*.ts",
  "e2e/**/*.ts"]` with `"exclude": []`. Closed.
- [OPEN — operational; see also the last entry in this file] **`pnpm test:content -- --workers=4` silently runs no tests.** The `--` is
  passed through to Playwright as a *filename filter*, so it matches nothing and
  the command exits 1 with "No tests found". Write
  `pnpm --filter @fluxiq-web-extension/extension test:content --workers=4`, with
  no `--`. Worth knowing beyond the typo: the wave rule about capturing exit
  status by redirect rather than through a pipe is what caught it. Through a pipe
  it would have been recorded as a passing suite that ran zero tests, which is
  the worst possible outcome of a test command. Found 2026-09-12 by
  v-spec-typecheck.
  **2026-09-12 by v-openq-audit:** duplicated by the final entry of this file
  ("Operational: `pnpm --filter ... test:content -- --workers=4` runs nothing"),
  found independently by w3-evidence-finish. Same defect, two workarounds: this
  entry's `pnpm --filter … test:content --workers=4` with no `--`, and that one's
  `pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=4` from
  `apps/extension`. Both work; the second is the one Wave 3 actually used. Fold
  them into one entry at the next compaction.

- [SETTLED — re-verified 2026-09-12] **Settled: whether `timed_out` survives the domain hop.**
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
  **Re-verified against the code 2026-09-12:** `domain/src/runtime/adapter.ts:87-91`
  still reads `const status = result.status ?? (result.ok ? "succeeded" :
  "failed")` under the comment naming `failureForCommandStatus`. Holds.
- [SETTLED 2026-09-12] **The gateway mapping never lifts the new action parameters, and no brief owns
  it.** `domain/src/client/gateway-mapping.ts` does not carry the Wave 2
  parameters (`checked`, the assert fields, the tab fields, and the rest) onto the
  command, so the seven new actions cannot be driven end to end even though their
  types, schemas, nodes and manifest outputs all exist. No Wave 2 brief lists that
  file under Owns, so this is a gap in the wave rather than a defect in any
  worker. Fix at integration or brief it explicitly in Wave 3; it is the last link
  between the vocabulary and a real Core-driven run. Found 2026-09-11 by
  w2-domain-vocabulary; owner: senior supervisor agent.
  **Settled — verified by reading the code.** `gateway-mapping.ts:138` spreads
  `...webAutomationLiftedActionParameters(parameters)` onto the command, and
  `domain/src/client/gateway-action-parameters.ts:61-70` lifts every Wave 2
  parameter — `scroll`, `wait`, `modifiers`, `checked`, `assert`, `extractList`,
  `upload`, `dialog`, `tab`, `download`, plus `tabId`/`frameId`/`newTab`/`option`.
  Each is validated, never coerced, and a refused value leaves the field absent
  (`gateway-action-parameters.ts:12-13`) — which is precisely what the "unusable
  parameter has no rejection channel" entry below is about. Landed in `ed6ab74`.

- [OPEN — the user's decision] **The Firefox floor predates the main-world dialog override.** The dialog verb
  overrides the page dialogs from the main world, which needs Chrome 111 or
  Firefox 128, while `manifest.firefox.json` declares `strict_min_version`
  109.0. On an older Firefox the override detects the wrong world and the verb
  fails honestly rather than silently, so nothing is unsafe. Raising the floor
  changes which browsers the product supports, which is the user decision, not the
  agent one. Not changed. Raised 2026-09-11 by w2-upload-dialog; owner: the user,
  to decide.
  **Verified still open 2026-09-12:** `apps/extension/manifest.firefox.json:43`
  still declares `"strict_min_version": "109.0"`. Unchanged; still the user's call.

- [OPEN] **The recorder never reports a checkbox checked state.** `content/
  describe-element.ts` omits it, so a recorded checkbox toggle carries no state
  and the mapping to `web.dom.check` deliberately stays evidence rather than
  replaying a guess; the previous behaviour typed the string on into checkboxes.
  A radio still maps deterministically. Closing this needs the recorder to report
  the state. Found 2026-09-11 by w2-domain-vocabulary; owner: senior supervisor
  agent.
  **Verified still open 2026-09-12:** `content/describe-element.ts` contains no
  `checked` at all, and `DomElementDescriptor` (`shared/protocol.ts:178-214`)
  declares no such field. Nothing in Wave 3 touched it.
- [SETTLED — re-verified 2026-09-12] **Settled: the domain target accessible-name field.**
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
  **Re-verified against the code 2026-09-12:** `domain/src/output-nodes/targets.ts`
  line 122 reads `accessibleName: stringValue(element.accessibleName) ??
  stringValue(attributes?.["aria-label"])`. Holds.

- [OPEN] **Landmark context carries a role but no name.** `context.landmark` records the
  landmark role only, so the two named regions in the `ambiguous-targets` fixture
  produce identical context, which a test now pins. Corpus workflow W26 resolves
  ambiguity by context and will need either the landmark name or an xpath or
  bounds fallback before it can pass. Not changed: the shape is a Phase 1.3
  decision and W26 is a Wave 4 workflow. Found 2026-09-11 by w2-identity-capture;
  owner: senior supervisor agent.
  **Verified still open 2026-09-12:** `shared/protocol.ts:227` declares
  `landmark?: string | undefined` with the comment "The nearest landmark role", and
  `content/identity/context.ts:40` fills it from `nearestLandmark(element)`, which
  returns a role. No name, no xpath, no bounds fallback. Still a Wave 4 blocker for
  corpus workflow W26.
- [SETTLED 2026-09-12] **Two page-scheme lists now exist.** `background/connection/browser-state.ts`
  decides which pages cannot be recorded, and w2-browser-actions added
  `runtime/unsupported-page.ts` for the same question on the action path. The
  older one misses `about:`, `view-source:` and `data:` and the current store
  hosts, so the two disagree. Point the background one at the newer module rather
  than maintaining two lists; the file is unowned by any Wave 2 brief. Found
  2026-09-11 by w2-browser-actions; owner: senior supervisor agent.
  **Settled — verified by reading both files.** There is one rule.
  `background/connection/browser-state.ts:39-45` calls
  `unsupportedAutomationPageReason` from `runtime/unsupported-page.ts` and maps only
  the *wording* locally (`RECORDING_REASONS`, lines 33-36), because the panel warns
  about recording rather than automation. The shared rule
  (`runtime/unsupported-page.ts:17-22`) matches a scheme with or without an
  authority, so `about:`, `view-source:` and `data:` are caught, and covers all four
  store hosts. Landed in `ed6ab74` ("One page-scheme rule replaces two that
  disagreed"). The behaviour change it caused is the entry below on eight URL
  classes, also settled.

- [SETTLED 2026-09-12] **The capabilities page understates what the code now does.**
  `docs/architecture/web-capabilities.md` rows 84 and 97 to 100 describe the
  pre-Wave-2 behaviour of the browser actions. Updating it is Phase 1.2 step 6 and
  was outside every Wave 2 brief, so it falls to integration or Wave 3. The
  repository rule is that authored documentation is updated in the same work as
  the change, so this is already overdue rather than optional. Found 2026-09-11 by
  w2-browser-actions; owner: senior supervisor agent.
  **Settled — verified by reading the document.**
  `docs/architecture/web-capabilities.md` was rewritten in `ed6ab74`: its summary
  table now reports `| Unreliable | 0 |` and `| Unsupported | 0 |` (lines 48-49),
  and the dispatch narrative matches the current code — the lifted parameters,
  `web.browser.tab`/`download` running in the worker, and `execute.ts` awaiting
  "one module per verb". Nothing in it now describes pre-Wave-2 behaviour.
- [OPEN — the most consequential open item in this file] **A recorded action can be silently dropped from the proposed Flow.** In one
  `basic-form` run of four, the click was recorded (`web.element.clicked`, one
  event) but only four of five candidates were proposed, so the Flow lost the
  action without reporting anything. The rerun passed. This is the most serious
  finding of Wave 2, because the whole week rests on a recording becoming a
  faithful Flow: a silent loss is worse than a failure, which at least announces
  itself. Not diagnosed: it appeared once, in a lane built for something else.
  Reproduce it deliberately before Wave 5 measures reliability, or the benchmark
  measures a number it cannot explain. Found 2026-09-11 by w2-flow-lane; owner:
  senior supervisor agent.
  **Verified still open 2026-09-12: nothing in Waves 2 or 3 addresses it.** No
  reproduction, no diagnosis, no guard. It remains the only known defect where the
  product loses a user's action and reports success, which is the failure mode the
  whole week's reliability claim rests on not having. Reproduce it before Wave 5
  measures anything.

- [OPEN — description corrected 2026-09-12: its blocker is gone] **The expired auth-gate workflow cannot report `auth_required` yet.** W19 runs
  its Flow and every action succeeds, so no structured failure is produced and the
  lane fails honestly against the manifest expectation. The cause is upstream of
  the lane: the recorded Flow has no step requesting `/account`, because the
  mapper excludes the client-side `location.assign` that navigates there. Closing
  it needs either `web.dom.assert` or the expectation evaluator of decision D10
  and Core contract C3. The worker deliberately did not weaken the assertion to
  make the run pass, which was the right call. Found 2026-09-11 by w2-flow-lane;
  owner: senior supervisor agent.
  **Corrected 2026-09-12 by v-openq-audit.** The cause is unchanged and still real:
  `domain/src/io/input-model.ts:109-112` maps a `pageNavigated` event to the
  `navigationRequested` action input only when `metadata.transition === "typed"`, so
  a client-side `location.assign` still yields no Flow step, and
  `auth-gate/manifest.ts:57` still expects `failure: { category: "auth_required" }`.
  But the stated closer — "needs either `web.dom.assert` or the expectation
  evaluator of decision D10 and Core contract C3" — has arrived. `web.dom.assert`
  shipped in Wave 2 (`content/actions/assert.ts`, and it now reports TIMEOUT as
  well as STATE_MISMATCH), and the expectation evaluator is bound downstream at
  `domain/src/runtime/host-runtime.ts:102` over `domain/src/runtime/expectation/`.
  This is no longer blocked on anything; it is unbriefed work.

- [OPEN — description corrected 2026-09-12] **A routine command deletes tracked build artifacts.** `pnpm lab` chains
  `pnpm build`, which removes and rewrites the eight tracked files under
  `apps/extension/build/`. That is why no parallel worker may run it, and why the
  flow lane drove the runner CLI directly instead. A command that deletes tracked
  files as a side effect is a trap for anyone who runs it casually. Either the
  artifacts should not be tracked, or the Lab should not chain a build. Raised
  2026-09-11 by w2-flow-lane; owner: senior supervisor agent.
  **Corrected 2026-09-12 by v-openq-audit.** The defect stands but the chain in this
  entry has drifted. Root `lab` (`package.json:49`) no longer chains `pnpm build`
  directly; it chains `pnpm --filter … extension test:e2e:build`, which is
  `pnpm build` (`apps/extension/package.json:11` → `:7`), which runs
  `scripts/build-extension.mjs`, whose line 58 is `await rm(buildDir, { recursive:
  true, force: true })`. So a routine `pnpm lab` still deletes and rewrites the
  tracked `apps/extension/build/` — now **ten** tracked files, not eight
  (`git ls-files apps/extension/build`). The choice is unchanged: untrack the
  artifacts, or stop the Lab chaining a build.

- [SETTLED 2026-09-12] **The action type must be joined through the node, and one lane gets it wrong.**
  Core records every recorded action as `builtin.policy.action`, so a lane
  checking which action ran must join through `nodeId` to the graph Flow
  `parameterValues.outputId`. The new Flow lane does this;
  `existing-flow-run.ts` still compares `definitionId` to the expected action, so
  it can only ever match by accident. It is unowned by any Wave 2 brief and
  untested against a real existing target here. Found 2026-09-11 by w2-flow-lane;
  owner: senior supervisor agent.
  **Settled — verified by reading the code.**
  `packages/test-runner/src/existing-flow-run.ts:105` calls `readFlowActionTypes`
  and line 133 returns `actionTypes.get(action.nodeId) ?? action.definitionId`, with
  lines 101-104 recording why `definitionId` cannot work. The join is the same one
  the Flow lane makes. (The cost this reuse brings to existing and clone runs is
  its own entry below, and is still open.)
- [SETTLED 2026-09-12 — with the predicted residue] **Two dependency members are dead weight.** `ContentActionDependencies` still
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
  **Settled — verified by reading the code.** `ContentActionDependencies`
  (`content/actions/types.ts:37-70`) no longer declares `waitForElement` or
  `waitForText`, and `action-runtime/execute-action.ts` no longer imports them from
  `./waits`. Exactly the residue this entry predicted remains: the two
  implementations survive, exported and unreferenced, at
  `content/action-runtime/waits.ts:79` and `:87` (a repository-wide grep over `src`
  and `e2e` finds no other caller; the only near-matches are `waitForTextAction`,
  the verb). If the structure audit's exported-values budget ever bites in that
  file, they are the first two to go.
- [SETTLED — re-verified 2026-09-12, including the wiring] **Settled: the node join in the run manifest.** `flowActionTimings` in
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
  **Re-verified against the code 2026-09-12,** because this entry's own lesson was
  that the fix first landed inert. `run-manifest/action-timings.ts:25` takes
  `actionTypes` and line 30 joins `actionTypes.get(action.nodeId) ??
  action.definitionId`; both call sites pass the map — `run-scenario.ts:194`
  (existing) and `:220` (clone). Not inert.

- [SETTLED 2026-09-12] **Eight URL classes are no longer recordable.** Pointing the background
  page-scheme check at the shared rule refuses eight classes of URL that the
  recording path previously accepted, including `about:`, `view-source:` and
  `data:` pages and the current store hosts. That is the intended direction, since
  the two lists disagreed and the shared one is correct, but it is a real
  behaviour change for anyone who recorded on those pages. The user-facing wording
  still says recorded rather than automated, deliberately. Note it in the
  extension client page when the capabilities page is updated. Found 2026-09-11 by
  w2i-unowned-defects; owner: senior supervisor agent.
  **Settled — verified by reading the document.** The note was made:
  `docs/architecture/extension-client.md:31` describes the one shared rule and line
  38 names the newly-refused classes explicitly — "`about:`, `view-source:`,
  `data:`, `devtools:`, and …". The user-facing wording still says *recorded*,
  which was the deliberate choice.

- [OPEN] **The shared action-type reader adds calls to existing and clone runs.** Reusing
  `readFlowActionTypes` in `existing-flow-run.ts` brings its `recording.contract`
  throw and two extra Automation Studio calls to any existing or clone run that
  asserts actions. Neither target can be exercised on this machine, so the cost
  and the throw are unmeasured against a real server. Check both before Wave 4
  leans on those targets. Found 2026-09-11 by w2i-unowned-defects; owner: senior
  supervisor agent.
  **Verified still open 2026-09-12:**
  `packages/test-runner/src/flow-lane/flow-action-types.ts:30` still throws
  `RunnerFailure("recording.contract", …)` when the approved Flow declares no
  output-dispatching node, and `existing-flow-run.ts:105` still reaches it on any
  existing or clone run that asserts actions. Neither target is exercisable on this
  machine, so the throw and the two extra Automation Studio calls remain
  unmeasured. Unchanged since raised.
- [OPEN — and now documented in the code as intended behaviour] **An unusable parameter has no rejection channel.** The domain now lifts every
  Wave 2 parameter onto the command and refuses malformed values rather than
  coercing them, which is right. But a valid action type carrying an unusable
  parameter has nowhere to say so: a refused upload reaches the page as a command
  with no files, and the content script can only report that the command carried
  no files. The operator sees a symptom, not the cause. An unknown action type
  already has a rejection path, added in Wave 1, so the shape exists to copy.
  Belongs with Phase 1.5, the failure taxonomy, where a refusal should be a
  classified failure rather than an empty command. Found 2026-09-11 by
  w2i-gateway-params; owner: senior supervisor agent.
  **Verified still open 2026-09-12, and sharper than when raised.**
  `domain/src/client/gateway-action-parameters.ts:12-13` now states the behaviour
  outright: "Nothing here coerces. A value of the wrong shape is refused, which
  leaves the command field absent and the raw parameter still visible in
  `options`." So a refused `upload` does reach the page as a command with no files.
  The rejection shape to copy is still there and still used for exactly one case:
  `gateway-mapping.ts:122-125` returns a `WebAutomationActionRejection` carrying
  `web.action.unsupported_type` for an unknown action type. A parameter refusal has
  no equivalent. Phase 1.5 work, unbriefed.
- [SETTLED — re-verified 2026-09-12] **The downstream half of the expectation seam has no brief.** The plan says
  Core exposes an optional expectation evaluator and the downstream binds it in
  `domain/src/runtime/expectation-evaluator.ts` over the `web.dom.assert`
  condition vocabulary. The Core half is briefed and running; the downstream
  binding appears in no Wave 3 brief. It could not have been briefed yet, since a
  seam cannot be bound before it exists, but it is the kind of half-finished
  crossing that goes missing between two repositories. Brief it as soon as the
  Core seam lands, or the evaluator ships with nothing calling it, which is
  exactly how the run-manifest join stayed inert. Raised 2026-09-11 at Wave 3
  dispatch; owner: senior supervisor agent.
  **Resolved 2026-09-12.** The Core seam landed shaped differently than the plan
  assumed — the evaluator is a method on `AutomationStudioHostRuntimeBoundary`,
  not a separate service binding — so the downstream half belongs on the same
  boundary object `w3-host-runtime` already creates. Briefing it separately would
  have collided on `host-runtime.ts`. It was folded into `w3-host-runtime`
  instead, with the evaluation logic in its own `domain/src/runtime/expectation/`
  module.
  **Re-verified against the code 2026-09-12, not against the report.**
  `domain/src/runtime/expectation/` exists (`conditions.ts`, `evaluate.ts`,
  `index.ts`, `tests/`); `host-runtime.ts:39` imports
  `createWebAutomationExpectationEvaluator`; line 102 binds `expectationEvaluator:
  (conditions, mode, timeoutMs, context) => evaluate(...)` onto the boundary; and
  line 68 declares `"expectation-evaluation"` among the host runtime capabilities.
  The seam is bound and not inert.
- [OPEN — both halves] **The runtime error type has no producer, and its code is not a closed type.**
  `WebAutomationRuntimeError` is referenced by the new classifier but nothing in
  the tree throws one, so the classifier has no real input yet. Worse, its `code`
  is typed as a plain `string` rather than the closed code set, so a code outside
  the set classifies as `UNKNOWN` at runtime instead of failing to compile. That
  is the difference between a standard the build enforces and one a reviewer has
  to notice. Narrow the type when the producers land in this wave, and add a
  producer, or the classifier is dead code with a permissive door. Found
  2026-09-11 by w3-failure-codes; owner: senior supervisor agent.
  **Verified still open 2026-09-12:** `domain/src/runtime/errors.ts` is nine lines
  and line 2 is still `readonly code: string;`. A repository-wide grep for
  `WebAutomationRuntimeError` finds constructions only in
  `domain/src/runtime/failure/tests/classify.test.ts` — no production producer. So
  the classifier's `WebAutomationRuntimeError` branch (`failure/classify.ts:128`) is
  still reachable only from tests, and an out-of-set code would still classify as
  `UNKNOWN` at runtime rather than failing to compile. Duplicated as sub-item 2 of
  the Wave 3 integration checklist below; keep one of the two at compaction.
- [SETTLED 2026-09-12 — all four gaps] **Redacting at one reader did not close the secret's other exits.** Phase 1.4
  step 1 was scoped as "stop the recorder capturing password values", and
  w3-redaction closed that properly by redacting inside `readElementValue`, which
  also fixed `recorder.ts` without editing it. But a value leaves the page by
  more routes than the value reader. `dom.keydown` was reconstructing the
  password one character per message — no single message held the secret, so a
  substring search over any one message would have passed while the recording
  still replayed it in order. And `content/actions/{type,clear,select}.ts` were
  interpolating the live value into their `expected` and `actual` validation
  strings, returning it to the gateway twice per typing result. Two further
  gaps: the `sensitive-input` fixture's card field carries no
  `autocomplete="cc-number"`, so the scenario that exists to prove card
  redaction could not have caught a card leak, and `recording/reducers.ts`
  writes `inputValue` into durable web state with no guard of its own, safe only
  while its producer redacts.
  The lesson for the rest of Week 1: a redaction brief must enumerate the
  value's exits — reader, event stream, action result, evidence packet, durable
  state — and prove each one, rather than naming the files where the value is
  read. Assert absence across a whole recorded session, not per message.
  Found 2026-09-12 by w3-redaction; the four gaps dispatched the same day as
  w3-redaction-followup. Owner: senior supervisor agent.
  **Settled — each of the four verified by reading the code.**
  1. `dom.keydown`: `content/dom-events.ts:122` emits `recordableKey(event.key,
     keyTarget)` rather than the raw key, and lines 15-19 record why the keydown
     path is the one that must redact for itself.
  2. Validation strings: `type.ts:45,56-57`, `clear.ts:51` and `select.ts:74-101`
     all route values through `describeFieldValue(value, withheld)`, with
     `withheld = isSensitiveFormControl(element)`. `select.ts` additionally
     withholds the option list, whose value space would have narrowed the secret
     to twenty items even where no single string held it.
  3. Fixture: `apps/scenario-lab/src/scenarios/sensitive-input/scenario.ts:44` now
     carries `autocomplete="cc-number"` on the card field *and* a second field with
     the multi-token `autocomplete="billing cc-number"` — the exact form that
     leaked in Wave 2 — so the scenario can now catch what it exists to catch.
  4. Durable state: `domain/src/recording/reducers.ts:40` guards the `inputValue`
     write with `!isSensitiveElementDescriptor(payload.element)`, so it no longer
     depends on its producer.
  The lesson in this entry — enumerate the value's exits and prove each — should
  outlive the closure; it is the reusable part.
- [SETTLED 2026-09-12] **Six content specs assert behaviour Wave 3 deliberately changed, and no brief
  owns them.** A full `test:content` run part-way through the wave was 115
  passed / 17 failed, every failure in `click`, `keyboard`, `select`,
  `check-assert`, `upload-dialog` or `resolve-target` — specs written in Wave 2
  that assert the old resolution behaviour and the old failure-code spellings
  that w3-resolver and w3-failure-producers were briefed to change. The specs
  are correct about the old contract and wrong about the new one, so this is
  expected mid-wave churn rather than a regression, but it means the content
  harness cannot gate anything until it is reconciled. This is the same defect
  as the Wave 2 entry above about `actions.spec.ts` being shared and unowned:
  when a brief changes a contract, the specs that assert the old contract have
  to be in that brief's Owns, or in a named reconciliation task. Fix at Wave 3
  integration, when the tree is still, and check each spec against the new
  contract rather than editing until green. Found 2026-09-12 by
  w3-frame-plumbing; owner: senior supervisor agent.
  **Settled — verified by reading all six specs.** Every `code:` assertion in
  `check-assert` (127, 140, 155), `click` (178, 195, 219), `keyboard` (203, 225,
  245, 263), `select` (156, 172, 191) and `upload-dialog` (72, 124) now reads
  `code: "web.action.rejected"` with `category:
  "blocked_by_capability_or_policy"`, and the reason is asserted where the collapse
  put it — `actual: "not_checkable: a radio cannot be unchecked…"`,
  `actual: "disabled: the checkbox is disabled"`. `resolve-target.spec.ts` is
  reconciled too: its header, lines 17-20, records the ambiguous rows moving to
  TARGET_AMBIGUOUS. Done by w3-spec-reconciliation and landed in `ee25ac9`.
- [SETTLED 2026-09-12] **The domain package cannot be consumed outside a bundler, and that is why the
  runner's vocabulary drifts.** Phase 1.5 step 5 asked the test runner to derive
  its allowlist from the domain's code set instead of repeating it.
  `packages/test-runner` cannot import the domain at all: `exports` maps `.` to
  `./src/index.ts`, which Node refuses (`ERR_UNKNOWN_FILE_EXTENSION`);
  `domain/dist/index.js` uses extensionless relative specifiers because the
  domain compiles under `moduleResolution: Bundler`, which Node also refuses
  (`ERR_MODULE_NOT_FOUND`); and a `NodeNext` consumer cannot even read its types.
  Every existing consumer bundles, so this has never surfaced before.
  This is the wave's recurring ownership defect one layer deeper: the brief's
  Owns was drawn correctly around the runner, but the change needs the *domain*
  to be publishable to a non-bundler consumer, which is a property of how
  `domain/` is compiled rather than a missing barrel line. It affects any future
  consumer outside the extension bundle.
  Deliberately not fixed during the wave: the fix changes `domain/tsconfig.json`
  and the package's `exports`, which would change what `check` reports for the
  four domain workers running at the time and could fail them mid-gate. Fix at
  Wave 3 integration on a still tree, then delete the deliberate second copy of
  the vocabulary that now lives in
  `packages/test-runner/src/tests/demo-llm-create-ui.test.ts` — it exists so a
  divergence fails loudly instead of dropping evidence silently, and it is the
  same duplication the brief set out to kill. Decide then whether the declared
  `@fluxiq-web-extension/domain` dependency stays: today it buys nothing and
  adds the domain to the Lab build graph.
  Found 2026-09-12 by w3-runner-alignment; owner: senior supervisor agent.
  **Settled by `11d2ed3` — verified by reading the package and its consumer.**
  `domain/package.json` now exports `"./node": { "types": "./dist/index.d.ts",
  "default": "./dist/index.js" }` beside the unchanged `.` and `./client`, and its
  build runs `clean-dist.mjs` then `rewrite-dist-specifiers.mjs` so Node can resolve
  what `moduleResolution: Bundler` emitted.
  `packages/test-runner/src/demo-llm-create-ui.ts:5` imports
  `WEB_LLM_EVIDENCE_RESULT_CODES` and `WEB_LLM_EVIDENCE_TOOL_IDS` from
  `@fluxiq-web-extension/domain/node`, and line 673 records that the two
  hand-maintained copies had already drifted, losing `web.reveal_safe` and
  `web.action.rejected.no_progress`. The deliberate second copy is gone, replaced by
  a derivation test (`src/tests/demo-llm-create-ui.test.ts:609`). The declared
  `@fluxiq-web-extension/domain` dependency (`packages/test-runner/package.json:15`)
  stays and now earns its place.
- [OPEN — the engineering is right, the plan text is not] **There are three failure vocabularies in this repository, and the plan names
  two.** Phase 1.5 step 5 says the runner's allowlist "derives from" the closed
  set in `codes.ts`. It cannot. The allowlist in `demo-llm-create-ui.ts` holds
  evidence-loop *result* codes (`web.inspect.succeeded`,
  `web.action.rejected.<reason>`), produced by `llm-evidence.ts`, which are not
  failure records at all; deriving it from `WEB_AUTOMATION_FAILURE_CODES` would
  drop both success codes and replace five reason-suffixed rejections with a
  single `web.action.rejected` that nothing emits — that is, it would drop every
  step. The three axes are the test-rig taxonomy (`failureCategories`, why the
  *facility* could not produce a trustworthy run), the browser-path failure codes
  (`codes.ts`, how the *automation* failed), and the evidence-loop result codes
  (`llm-evidence.ts`). Correct the plan text and any brief that repeats the
  conflation. Found 2026-09-12 by w3-runner-alignment; owner: senior supervisor
  agent.
  **Verified 2026-09-12, and narrowed to a documentation fix.** The three axes are
  real and the code now respects them: the runner's allowlist derives from the
  *evidence-loop* vocabulary (`WEB_LLM_EVIDENCE_RESULT_CODES`,
  `WEB_LLM_EVIDENCE_TOOL_IDS` via `@fluxiq-web-extension/domain/node`), not from
  `WEB_AUTOMATION_FAILURE_CODES`, and `runnerFailureCategories` is gone (a grep
  finds no occurrence in `packages/test-runner/src`).
  The plan still says the wrong thing, in two places:
  `mvp-week1-web-automation-reliability-plan.md:591-592` — "Codes are a closed set
  in `codes.ts`; the test-runner's allowlist derives from it" — and `:600-601`,
  Phase 1.5 step 5, "allowlist generated from domain codes". Both read as though one
  vocabulary feeds the other. Correcting them is a two-sentence edit and it belongs
  to whoever next touches the plan; leaving it is how the next brief repeats the
  conflation.
- [SETTLED 2026-09-12] **Three different `truncated` flags are landing on one evidence path.**
  w3-state-identity adds `elements.truncated` to recording state, w3-evidence
  adds a snapshot-level `truncated` with pre-filter totals, and w3-llm-packet
  adds a byte-budget `truncated` to the sanitized packet. All three are correct
  in isolation and all three are called the same thing on the same path, so a
  consumer cannot tell which limit it hit. Reconcile at integration: either
  qualify each name or make them one nested structure. Found 2026-09-12 by
  w3-state-identity; owner: senior supervisor agent.
  **Settled — verified by reading the code.** The three were qualified rather than
  merged, and the rule is written down.
  `domain/src/recording/web-state/evidence/input.ts:19-34` states it: a bare
  `truncated` is legal only *inside* the structure whose items it describes, and it
  carries the table of every limit. `web-state/snapshot.ts:51-53` writes the three
  element paths — `elements.captureTruncated` (the browser's own cap),
  `elements.stateTruncated` (the state cap), and `elements.truncated` as the
  explicit OR of the two, kept because "may I trust this list to be the page" is
  still one question. `runtime/llm-evidence/sanitize.ts:10-15` documents the
  packet's byte-budget flag as its own third thing. A consumer can now tell which
  limit bit.
- [SETTLED 2026-09-12] **`elements.count` changed meaning, and its declaration did not.**
  w3-state-identity made `elements.count` the pre-filter total and added
  `elements.captured` and `elements.truncated`, but `domain/src/recording/
  domain.ts` still declares `elements.count` as "Captured element count" and
  does not declare the other two. That file was another worker's during the
  wave. Nothing fails today because the `elements.*` wildcard covers validation,
  so the panel's labels are simply wrong. Three declaration lines, to apply at
  integration. Consider at the same time whether the wire-visible meaning change
  is right, or whether a new `elements.total` would be kinder to consumers —
  w3-state-identity reports it is cheap to invert. Found 2026-09-12 by
  w3-state-identity; owner: senior supervisor agent.
  **Settled — verified by reading the declarations.**
  `domain/src/recording/domain.ts:20-29` now declares all five: `elements.count`
  labelled "Elements on the page" (the pre-filter total, corrected from "Captured
  element count"), `elements.captured` "Elements captured", `elements.truncated`
  "Element list incomplete", `elements.captureTruncated` "Browser capture dropped
  elements", and `elements.stateTruncated` "State cap dropped elements". The
  panel's labels are right. The alternative this entry raised — a new
  `elements.total` instead of changing what `count` means — was not taken; the
  meaning change stands, deliberately.
- [SETTLED — re-verified 2026-09-12, and the follow-up work is done] **Settled: the per-reason rejection codes collapse, and the reason is not
  lost.** w3-failure-producers replaced `web.action.rejected.<reason>` with the
  set's single `web.action.rejected`, which breaks 15 `code:` assertions across
  five content specs it does not own (`check-assert` 84/93/104, `click`
  170/185/204, `keyboard` 203/220/237/252, `select` 153/166/182, `upload-dialog`
  70/119). The supervisor checked whether the collapse discards information
  before accepting it. It does not. Core's `AutomationStudioFailureRecord` has a
  closed field set — `category`, `code`, `retryable`, `stage`, `expected`,
  `actual`, `evidenceDigest` — and `parseAutomationStudioFailureRecord` rejects
  anything else, so a bespoke `reason` field could never have survived the wire
  anyway. The producer writes the reason into `actual` as
  `` `${reason}: ${observed}` ``, and `actual` is precisely Core's "short
  description of what was observed instead". So the reason travels; only its
  location changed. Update the 15 assertions to the collapsed code and assert
  the reason in `actual`; do not revert the collapse.
  Distinct and **not** to be merged with this: `web.action.rejected.<reason>` in
  `llm-evidence/` is an evidence-loop *tool refusal*, a different axis that
  merely shares a prefix. Settled 2026-09-12 by the supervisor.
  **Re-verified 2026-09-12:** the collapse holds
  (`domain/src/runtime/failure/codes.ts:27`, `ACTION_REJECTED:
  "web.action.rejected"`), and the 15 assertions this entry told the supervisor to
  update *were* updated — see the settled "Six content specs" entry above. The
  reason travels in `actual` exactly as predicted: `"disabled: the checkbox is
  disabled"`, `"not_checkable: a radio cannot be unchecked…"`. Nothing left to do.
- [SETTLED 2026-09-12] **Level 2 target scoring is blocked by Core packaging, and D1's stated premise
  is false.** D1 says Core's matcher "is public via `fluxiq/automation-studio`,
  has type-only imports, and bundles under the existing esbuild
  `platform: browser` build". w3-resolver reproduced the opposite: that barrel
  reaches `node:crypto` and `node:perf_hooks`, and bundling it for the browser
  fails with five resolution errors. The worker deliberately did not create
  `score.ts` rather than reimplement Core's scoring downstream, which was the
  right call — a second scorer is exactly what D1 exists to prevent.
  The fix is a Core `exports` subpath for `fingerprinting/`, plus an alias in
  `apps/extension/scripts/build-extension.mjs` and a `paths` entry in
  `apps/extension/tsconfig.json`. Prefer that over D1's documented fallback
  (returning candidates for Core to score out of process), because the fallback
  gives up the live-DOM signals that motivated D1. Deliberately deferred during
  the wave: the build script is the one file every worker's `test:content`
  depends on. Do it at integration on a still tree, and re-measure the content
  bundle — the domain import already grew it 32%, which is unratified.
  Note that Level 1 did land: exact-match gating, candidate enumeration and the
  ambiguity failures are in. Found 2026-09-12 by w3-resolver; owner: senior
  supervisor agent.
  **Settled by `11d2ed3` — verified by reading the code.** The Core `exports`
  subpath landed and this repository uses it:
  `apps/extension/src/content/identity/score.ts:38` imports from
  `fluxiq/automation-studio/fingerprinting`, `scripts/build-extension.mjs:122`
  aliases that specifier to Core's source, and
  `content/action-runtime/resolve-target.ts:27-42` documents Level 2 running at the
  two points where an exact answer is not one, scoring with Core's own matcher
  rather than a second scorer written here — which was the whole point of D1.
  The bundle was re-measured rather than inferred: 18,974 bytes, 8.5%, attributed
  by esbuild metafile. The refusal floor is proven by a passing row on
  `identity-drift` (Discard −0.360 ahead of the real Save −0.375, and the resolver
  refusing both). The documented fallback — returning candidates for Core to score
  out of process — was correctly not taken.
- [OPEN — description corrected 2026-09-12: the declared field is now write-only] **Corrected: the fingerprint does reach the content script.** The supervisor
  read `WebAutomationActionCommand`, found no `element` or `fingerprint` field,
  and told two workers the fingerprint was being dropped at the boundary and
  that the resolver was being built against an input that never arrives. That
  was wrong, and the error was concluding too much from a missing named field
  without following the untyped `options` blob. w3-resolver disproved it by
  bundling the domain source and executing the path: `payloads.ts` puts the
  fingerprint in the node's *parameters*, and `webAutomationActionFromGateway
  Command` ends with `options: parameters`, so it arrives as
  `action.options.element`, which is where the resolver already reads it.
  What remains is real but smaller: the fingerprint travels through an untyped
  blob that no type describes and nothing validates, so promoting it to a
  declared optional field is a contract improvement rather than a repair, and
  both paths must stay live until the untyped one is removed deliberately.
  The lesson: reading a type tells you what is declared, not what is carried.
  Corrected 2026-09-12; owner: senior supervisor agent.
  **Corrected 2026-09-12 by v-openq-audit.** The correction itself holds. But its
  "what remains" has half landed, in a way that is worse than either end state and
  should be closed deliberately.
  The declared field now exists: `domain/src/actions/types.ts:189` declares
  `element?: WebAutomationElementFingerprint`, and `gateway-mapping.ts:137`
  populates it through `commandElementFingerprint`, which even chooses between the
  recorded and the Core-adapted identity by whether Core matched a candidate
  (`elementFingerprintSources`, lines 163-189).
  Nothing reads it. `content/action-runtime/resolve-target.ts:362-366`
  `recordedTarget()` still reads **only** `action.options?.element`. So the typed
  path is write-only and the untyped blob is the sole live read: deleting `options`
  would silently cost the resolver every identity signal while the compiler stayed
  green — the exact failure this contract improvement was meant to prevent. One
  line in `recordedTarget` (prefer `action.element`, fall back to
  `action.options?.element`) closes it.
- [PARTLY SETTLED — 2 of 6 closed; audited 2026-09-12] **Integration checklist accumulating from Wave 3 reports.** Each is small,
  unowned, and needs a still tree: the four failure builders in
  `validation-outcome.ts` now have zero production call sites; narrowing
  `WebAutomationRuntimeError["code"]` to the closed set is a two-line change in
  `domain/src/runtime/errors.ts` with no import cycle; `action-runner.ts:76`
  still sends `topFrameOnly` for `capture_snapshot`, so frame coverage cannot
  match the state pipeline; tracked `domain/.test-build/` is stale and needs one
  unlabelled domain test run; `docs/architecture/testing-facility.md:34` names
  the deleted `domain/src/runtime/llm-evidence.ts`; and
  `e2e/content/tests/resolve-target.spec.ts` and
  `content/action-runtime/wait-conditions.ts` should have been in w3-resolver's
  Owns. Collected 2026-09-12; owner: senior supervisor agent.
  **Audited item by item 2026-09-12 by v-openq-audit, each by reading the file.**
  1. **Settled.** The four builders in `validation-outcome.ts` are gone, not merely
     uncalled. The file's exports are now `VALIDATION_TEXT_MAX_LENGTH`,
     `truncateValidationText`, `boundValidation` and `statusForValidation`, pinned
     by `tests/validation-outcome.test.ts:61`; lines 9-30 record why deleting them,
     rather than narrowing them, was what shut the door.
  2. **Still open.** `domain/src/runtime/errors.ts:2` is still `readonly code:
     string;`. Same as the standalone entry above — merge the two.
  3. **Still open, and the line number has moved.** It is now
     `action-runner.ts:218`, not `:76`: `runActionInFrame` sends `topFrameOnly:
     frameId === undefined`, and `content/message-handler.ts:43` makes that mean
     "top frame only". So a `web.dom.capture_snapshot` naming no frame still runs
     in the top frame alone, while the state pipeline merges every frame
     (`captureMergedTabSnapshot`). Frame coverage still cannot match.
  4. **Still open.** `domain/.test-build/` is tracked (`git ls-files`) and stale:
     `domain.test.mjs` is dated 2026-09-11 00:05, before every Wave 3 domain
     change. One unlabelled domain test run on a still tree.
  5. **Settled.** `docs/architecture/testing-facility.md:34` now names the
     directory, `domain/src/runtime/llm-evidence/`, which exists. The remaining
     `.ts` references are all in `docs/working/` history and briefs, which are
     records of what was true then.
  6. **Process note, no code state.** The ownership observation about
     `resolve-target.spec.ts` and `wait-conditions.ts` is a lesson, not a task.
- [OPEN — process lesson, no code state] **Three Wave 3 briefs granted the same file with no partition inside it.**
  `apps/extension/src/runtime/action-runner.ts` appears under Owns in
  w3-frame-plumbing, w3-extension-gaps (granted mid-wave on request) and
  w3-worker-codes. Nothing was lost, but only because each change happened to
  touch different named lines and the three ran at different times. The wave's
  own rule is that briefs are partitioned by file; where a file genuinely must be
  shared, the brief has to name the region or the function, and the supervisor
  has to serialize the workers rather than trust that their edits will not meet.
  Raised 2026-09-12 by w3-worker-codes; owner: senior supervisor agent.
  **2026-09-12:** nothing to verify in the tree; the rule it asks for is a
  supervisor practice. It is the same lesson as the `actions.spec.ts` entry at the
  top of this file and the two ownership failures recorded in the run-manifest and
  runner-alignment entries. Four instances now; worth promoting to the plan's
  wave-dispatch rules rather than leaving as a fourth open question.
- [SETTLED — re-verified 2026-09-12] **Settled: `workerActionFailedFailure` maps to `ACTION_FAILED`, not `UNKNOWN`.**
  The supervisor's brief told w3-worker-codes to map it to `UNKNOWN`, glossing
  that member as "the action ran and failed for a reason no other code names".
  That sentence is `ACTION_FAILED`'s docstring verbatim
  (`domain/src/runtime/failure/codes.ts:50`); `UNKNOWN` is "Nothing said why the
  action failed", and all three call sites do say why. The worker declined the
  mapping and was right. It also showed with a mutation that `UNKNOWN` would have
  changed the category to `ambiguous_or_unknown` and `retryable` to `false`,
  which is a behaviour change on Core's retry path rather than a naming choice.
  A second defect surfaced in the same work and is worth remembering: narrowing
  the type alone would have produced records that contradict themselves, because
  `workerBlockedFailure` hard-wrote stage `dispatch` while `ACTION_REJECTED`'s
  row says `execution`. The builders now delegate to `webAutomationFailureRecord`
  so the code's own table decides category, retryable and stage, which is the
  mechanical enforcement the closed set was created for. Settled 2026-09-12.
  **Re-verified against the code 2026-09-12:**
  `apps/extension/src/runtime/action-results.ts:144-145`
  `workerActionFailedFailure` delegates to `webAutomationFailureRecord(code, {
  expected, actual })`, as do the neighbouring builders at lines 98, 107, 123 and
  134, so the code table decides category, retryable and stage.
  `domain/src/runtime/failure/codes.ts:51,114` confirms `ACTION_FAILED` is
  `action_failed` / retryable / `execution` and `:53,115` that `UNKNOWN` is
  `ambiguous_or_unknown` / not retryable — the behaviour difference the worker
  measured. Holds.
- [OPEN — description corrected 2026-09-12: the stated blocker is gone] **Half of the headline audit finding is now closed, and it is worth being
  precise about which half.** The Week 1 audit said "Core's element matcher never
  receives candidates and its top signals are zero for web targets". Those are two
  defects, not one.
  The *signals* half is fixed. `outputTargetFromPayload` preferred Core's
  normalized target over the recorder's fingerprint, and Core's normalizer builds
  that fingerprint only from the parameters' top-level keys, so the wire target
  collapsed to a bare selector on every dispatch. w3-target-signal-order reordered
  the chain — the adapted copy wins only when Core actually matched a candidate —
  and measured the wire target going from **1 to 12 signals** on the executed
  path, with both drift branches unchanged so drift recovery is preserved.
  The *candidates* half is still open, and nothing in Wave 3 closes it. It needs
  the content script to enumerate live-DOM candidates and return them, which is
  Level 2 scoring, blocked on the Core packaging problem recorded above. Until then the
  matcher still receives no candidates. Do not read the signal fix as closing the
  exit criterion.
  A correction to the supervisor's brief, the fourth of this wave: the degrading
  link was `adaptedTarget.fingerprint`, not `adaptedTarget.element` — Core emits no
  `element` on a normalized target at all. The fix was the same either way, but the
  mechanism in the brief was wrong. Recorded 2026-09-12 by w3-target-signal-order.
  **Corrected 2026-09-12 by v-openq-audit.** The signals half is settled and its
  account here is accurate. The candidates half is no longer described correctly:
  it says the remainder "needs the content script to enumerate live-DOM candidates
  and return them, which is Level 2 scoring, blocked on the Core packaging
  problem". Level 2 landed in `11d2ed3` and the packaging problem is closed (see
  that entry above). The content script now enumerates candidates and scores them
  **with Core's own matcher, in the browser** — `content/identity/score.ts`, driven
  from `resolve-target.ts:27-42`.
  What is still literally true is narrower, and is now a design question rather
  than a blocked task: nothing populates `candidates` on the *wire*, so Core's
  out-of-process matcher still receives none, and `gateway-mapping.ts:178-181`
  still says so in as many words ("It matched nothing, which is every dispatch
  today, because nothing populates `candidates` yet"). Decide whether the wire ever
  needs to carry them, given the scoring now happens where the live DOM is — which
  was D1's whole motivation. Do not re-derive this as blocked work.
- [OPEN] **The domain test runner aborts the whole suite on the first throw.** Every
  bundle is imported in one process, so a single failing assertion stops the run
  before most files execute, and a concurrent worker sees `# tests 10` and an
  abort rather than one red row. That happened during Wave 3: one stale assertion
  in `client/tests/gateway-mapping.test.ts` masked the state of the entire domain
  suite for every worker running at the time, and diagnosing it needed a
  per-entry run in separate processes. The supervisor fixed the assertion (the
  suite is 234/234 green again), but the runner behaviour is the real defect: a
  test runner that hides 200 results behind the first failure is actively
  misleading during parallel work. Make it isolate failures, or at minimum report
  what it did not get to. Found 2026-09-12 by w3-target-signal-order; owner:
  senior supervisor agent.
  **Verified still open 2026-09-12:** `domain/scripts/test-domain.mjs:54-56` is
  `for (const entry of entryPoints) { … await import(pathToFileURL(bundle).href); }`
  with no `try`/`catch` and no per-entry reporting, so the first throw still ends
  the run and hides every entry after it. Unchanged.
- [OPEN — standing operational guidance] **The content harness fails catastrophically and misleadingly under default
  Playwright concurrency on this machine.** w3-spec-reconciliation's first run
  reported **66 of 66 failed**, every one a 30-second timeout inside
  `e2e/content/harness.ts:88` with no assertion diff. That is indistinguishable
  at a glance from a content script hanging on every single action — the exact
  symptom of a catastrophic product regression — and it is nothing of the kind.
  At `--workers=3` and `--workers=4` the same tree passes 179 of 179, exit 0.
  Run the content harness with `--workers=4` here. This belongs with the two
  environmental entries above (`tsc` access violations, Core's native SQLite
  corrupting vitest workers): on this machine, a total and uniform failure under
  parallel load is the machine, and the tell is that every failure is a timeout
  with no assertion diff. A partial failure with real diffs is a real failure.
  Found 2026-09-12 by w3-spec-reconciliation; owner: senior supervisor agent.
  **Corroborated 2026-09-12:** both Wave 3 commit messages record the harness green
  only at that concurrency — `ee25ac9` "content harness 181 passed at --workers=4",
  `11d2ed3` "content harness 186 passed at --workers=4". Keep the tell in mind: a
  total, uniform failure whose every case is a timeout with no assertion diff is
  the machine; a partial failure with real diffs is real.
- [SETTLED 2026-09-12] **Three assert rows are tests that cannot fail.** Three of the five reconciled
  assert rows pass `timeoutMs: 200` to exercise the expiry path, but
  `AssertionOutcome` carries no timing, so they assert `STATE_MISMATCH` — and
  would assert exactly the same if the polling loop were deleted outright. The
  wait is therefore unproven in both directions: nothing shows it waits, and
  nothing would notice if it stopped. This is the same root gap as
  "`web.dom.assert` cannot report `TIMEOUT` at all", reported independently by
  w3-extension-gaps. Fixing the timing fixes both. Found 2026-09-12 by
  w3-spec-reconciliation; owner: senior supervisor agent.
  **Settled — verified by reading the outcome type, the verb and the tests.**
  `AssertionOutcome` (`content/action-runtime/assertion-evaluation.ts:48-60`) now
  carries `judged`, `waitExpired`, `timeoutMs`, `elapsedMs` and `attempts`, and
  `evaluateAssertion` (lines 67-92) fills them from a real polling loop.
  `content/actions/assert.ts:88` routes an expired window to `deps.timedOut` with
  TIMEOUT and status `timed_out`, so the sibling gap — "`web.dom.assert` cannot
  report `TIMEOUT` at all", reported independently by w3-extension-gaps — is closed
  by the same change, exactly as this entry predicted.
  The rows can now fail in both directions.
  `content/action-runtime/tests/assertion-evaluation.test.ts:52-53` asserts the
  claim is judged more than once and that the wait took at least 100 ms; `:68-69`
  asserts the whole 200 ms window is spent. Delete the polling loop and those fail.
  The specs assert the distinction too:
  `e2e/content/tests/check-assert.spec.ts:175-196` expects `status: "timed_out"`
  with `web.action.timeout` where it previously expected STATE_MISMATCH.
- [SETTLED — record] **Resolved: the page evidence is live, and the wire-ordering change is not
  needed.** w3-evidence-seams reported the new evidence as "correct, live and
  dormant", and named two possible fixes: carry `evidence` through the domain
  state projection, or make `client.recording_event` carry the merged snapshot
  instead of the frame-local one. The supervisor briefed both. Only the first was
  necessary, and the second would have changed what goes on the wire for every
  recorded event to no purpose.
  The live chain, traced by reading each link rather than inferring it:
  `connection.ts:422` calls `sendRecordingEvidence`, which calls
  `captureDomSnapshotForEvidence` → `captureMergedTabSnapshot` (the cross-frame
  merge) → `createStateFromDomSnapshot` → `createWebAutomationStateFromSnapshot`
  (which now carries evidence) → `client.snapshot`. The evidence never needed to
  ride on `client.recording_event` at all; it travels on `client.snapshot`
  beside it. `connection.ts` is deliberately unchanged.
  This is the fifth premise the supervisor handed a worker that turned out to be
  wrong, and the first where the error would have caused a risky change rather
  than a wasted one. The recurring mistake is the same each time: reading one
  file and inferring the path instead of following it. Resolved 2026-09-12.
  **2026-09-12:** left as the record it is. The conclusion is consistent with the
  current tree — `client.recording_event` was not changed and the evidence rides on
  `client.snapshot`. The lesson ("reading one file and inferring the path instead
  of following it") is the durable part.
- [SETTLED — record] **The evidence pipeline now has a joinery test, which is the class of test
  that was missing.** `apps/extension/src/background/tests/recording-evidence-
  pipeline.test.ts` runs producer → cross-frame merge → domain projection in one
  process. Its header states the lesson plainly: each of the three was tested on
  its own and the chain between them was not, "which is how the evidence came to
  be produced, merged, and then silently dropped". It also plants a value the
  producer should have withheld, so the projection is checked for defence in
  depth rather than trusting its upstream. Prefer this shape wherever a Week 1
  contract crosses two modules. Added 2026-09-12 by w3-evidence-consumption.
  **Verified 2026-09-12:**
  `apps/extension/src/background/tests/recording-evidence-pipeline.test.ts` exists.
  Keep as a practice note, not an open question.
- [SETTLED 2026-09-12 — the protocol type was fixed] **Corrected: narrowing the builders did not close the failure-code set.** The
  supervisor reported after w3-worker-codes that an out-of-set code could no
  longer reach the wire because the `code` parameter was typed. That was
  overstated. A narrowed *builder* rejects an out-of-set string with `TS2345`,
  but a hand-written record literal still compiles, because `code` on the
  protocol's failure record in `apps/extension/src/shared/protocol.ts` is a bare
  `string`. What actually shut the door in those files was deleting the offending
  builders — not the compiler — so it reopens the moment anyone writes a record
  by hand. Found 2026-09-12 by w3-assert-timing, which proved it by reintroducing
  a record and observing `check` exit 0. Being fixed at the protocol type.
  The general lesson, and the third instance of it this wave: a type narrowed at
  one call site is not an invariant. The invariant lives wherever the value is
  *declared*, and three workers reached that same seam from three directions
  before anyone looked at it.
  **Settled — verified by following the type, which is what this entry is about.**
  "Being fixed at the protocol type" is done.
  `apps/extension/src/shared/protocol.ts:338` declares `BrowserActionResult =
  WebAutomationActionResult<DomElementDescriptor, DomSnapshot>` — the domain's own
  type, not a copy (lines 327-335 say why) — and `domain/src/actions/types.ts:284`
  declares `failure?: WebAutomationFailureRecord`, which
  `domain/src/runtime/failure/codes.ts:75` defines as
  `Omit<AutomationStudioFailureRecord, "code"> & { code: WebAutomationFailureCode }`.
  So a hand-written record literal carrying an out-of-set code no longer compiles;
  the invariant now lives where the value is declared, which is what this entry
  argued for. One stale trace remains, outside this file:
  `content/action-runtime/validation-outcome.ts:24-28` still says the record type
  "types `code` as a bare `string`".
- [OPEN — and now AT the limit, not near it] **`connection.ts` is close to its hard limits.** 745 of 800 lines, and
  `FluxIQConnection` carries 39 of its 40 permitted methods. The next change
  there will fail the structure audit rather than merely warn. Split it before
  Wave 4 rather than during whatever task first trips it. Found 2026-09-12 by
  w3-evidence-finish; owner: senior supervisor agent.
  **Verified and worsened 2026-09-12.**
  `apps/extension/src/background/connection.ts` is 745 lines against
  `fileLines: 800`, and the file declares one class, `FluxIQConnection` (line 85).
  A count of method declarations at class indent gives **40**, against
  `classMethods: 40` in `scripts/structure-audit/context.mjs:44` — the hard limit,
  not the 25-method advisory. On that count the next method fails the audit
  outright rather than warning. (The count is a regex over class-indent
  declarations, so read it as 39 or 40; either way it is at the boundary.) Split it
  before Wave 4, as this entry says.
- [SETTLED — record, accepted trade-off] **A merged multi-frame recording event is bigger, deliberately.** Now that the
  recording event carries the tab-merged snapshot, a multi-frame page sends the
  whole tab: measured +4.3 KB at two frames and +12 KB at six, and exactly zero
  change on a single-frame page. Accepted for now — the alternative was a second
  full merge per event, which costs a `captureSnapshot` round trip per frame on a
  DOM sweep that Phase 1.4 made seven passes heavier. w3-evidence-finish reports
  the lever to narrow it is one line in `connection.ts` if the byte cost turns
  out to matter more than the completeness. Revisit with real page measurements,
  not synthetic ones. Recorded 2026-09-12.
  **2026-09-12:** left as the record it is. Nothing to close; revisit only with real
  page measurements, as it says.
- [SUPERSEDED — duplicate; merge with the `--workers=4` entry above] **Operational: `pnpm --filter ... test:content -- --workers=4` runs nothing.**
  pnpm forwards the literal `--`, and Playwright reports "No tests found", which
  reads as a broken harness rather than a bad command line. Run it directly:
  `pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=4`
  from `apps/extension`. Found 2026-09-12 by w3-evidence-finish.
  **2026-09-12 by v-openq-audit:** this and the earlier
  "`pnpm test:content -- --workers=4` silently runs no tests" entry are the same
  defect found twice, by v-spec-typecheck and by w3-evidence-finish. Keep one at
  the next compaction; this one carries the better workaround (`pnpm exec
  playwright test -c e2e/playwright.content.config.ts --workers=4` from
  `apps/extension`), that one carries the reason the pipe-versus-redirect rule
  caught it.
