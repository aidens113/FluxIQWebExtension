# t361 lasting-act follow-ups: undelivered presses, the exploring model told, docs

Worker: t361-lasting-followups (worker-high). Worktree `C:\Users\osrs_\FluxStuff\fxwork\t361\` (Core-paired, branch `task/t361-lasting-act-followups`). Nothing committed.

## Outcome

Done. All three parts are in place, with fail-first tests for parts 1 and 2:

1. **Undelivered presses.** When the browser refuses the extension's send before it reaches the page, the action's failure now says `effect: "unacted"`. Core then retries it. A send that did reach the page and lost its answer says nothing, so a lasting act stays uncertain and is not retried.
2. **The model is told.** Exploration (`core.run_node`) and mid-build test replays now read Core's `lastingAct: "uncertain"`. They report the step as `outcome_uncertain` in plain words, and the act is sent only once.
3. **Docs.** The architecture docs in both repositories now describe t359's rule and t361's additions.

One provider-free Lab run on crossborder-marketplace looked the same as t359's run. No paid or provider calls were made.

## What changed and why

### Part 1: extension, downstream (`apps/extension/src/runtime/`)

The files are in `runtime/`, not `background/`. This is the background service worker's action transport, which is where t359's report pointed. `background/tabs.ts` is unchanged.

- **`page-delivery.ts`** (new). `trackActionDelivery(send)` wraps `sendToTab` and counts the action's own sends. It also counts the sends the browser refused before delivery, matched by the browser's own words:
  - "Receiving end does not exist" (Chrome and Firefox);
  - "No frame with id";
  - "No tab with id".

  `mayHaveReachedPage()` is false only when every send of the action was refused that way, or when none was made. It does not track:
  - readiness pings;
  - landing reads;
  - frame lookups.

  A send that may have arrived makes the answer true, which is the cautious direction. The file name avoids the audit's `action-` prefix rule: there are already three files with that prefix in `runtime/`.
- **`action-runner.ts`**:
  - `runBrowserActionCommand` creates the tracker and passes it to `runActionInFrame`, and from there to `sendAction`. That covers both the direct send with its one re-send for reads, and the across-document sender used by paged `extract_list` and `next_page`.
  - If `runActionInFrame` throws and the action never reached the page, the runner returns `undeliveredActionFailure`. That is `browserActionFailure`'s record plus `effect: "unacted"`.
  - Every other throw still goes to the command router as before. Navigate, tab and download do not use this path and are unchanged.
- **`index.ts`**: barrel export for the new file.

Why this is enough: the domain adapter already keeps a client-stated `unacted` for every action (`lastingActStated`, t359). Core's assessment already retries a fault marked `unacted`.

### Part 2: domain, downstream (`domain/src/runtime/llm-evidence/`)

- **`node-run/retries/uncertain-outcome.ts`** (new). `webNodeFailureRefusal(result, lastingAct)` returns the failure's own refusal (`webActionFailureRefusal`), unless `lastingAct === "uncertain"`. In that case:
  - the code stays the failure's own, such as `action_failed`, `page_changed` or `action_timed_out`;
  - the reason becomes `outcome_uncertain`.

  I put it in `retries/` and exported it through that barrel. That way `run.ts` did not need a new import line and stays at exactly 800 lines, the audit limit.
- **`node-run/run.ts`** (exploration) reads `lastingAct` from `webNodeDispatchWithRetries` and uses `webNodeFailureRefusal`. The import of `webActionFailureRefusal` was dropped because it is no longer used there.
- **`node-run/replay.ts`** (test replays) does the same. An uncertain step answers:
  - `core.replay.failed`;
  - `resultReason: "outcome_uncertain"`;
  - `said`: "the step was sent, and whether it took effect is uncertain (<code>): it was not made again, since making it twice could do it twice".
- **`node-run/retries/index.ts`**: exports the helper.
- **`tool-rejection.ts`** (not listed in the brief's Owns; needed for the new reason):
  - Added `outcome_uncertain` to `WEB_LLM_TOOL_REJECTION_REASONS`, with its documentation.
  - `rejectionDetail` gives it a `next` sentence: "Outcome uncertain: this step was sent to the page, but its answer does not show whether it took effect, so it was not made again automatically -- making it twice could do it twice. Look at the page to see whether it took effect before making the same call again."
  - The documentation for `channel_to_page_failed` now points a lasting act whose channel closed after sending to the new reason.

  `capture.ts` and `refusal-diagnostic/screen.ts` validate reasons against that list, so they accept the new reason with no change. No other file in either repository lists the reasons.
- **`checkEffect`** is still not passed on these paths. Exploration and replay have no evidence that proves a press landed:
  - "the page changed" proves nothing;
  - the replay statement records nothing expected about a press.

  So they pass no check, an uncertain act is never settled as landed, and the model is told to look. This is written down in both docs.

### Part 3: docs

- Downstream `docs/architecture/web-capabilities.md`, "Default browser recovery". I replaced t355's one-sentence rule with a section on lasting acts. It covers:
  - the committing set;
  - the adapter's `unacted` and `ambiguous` statements;
  - the extension's undelivered statement, and why "message port closed" stays ambiguous;
  - t355's rule for other page-changing actions;
  - Core's lasting-node sources and `actUncertain` consequences, including "Outcome uncertain", Flow continuation and the ladder rungs;
  - what the model and test replays are told.
- Core `docs/architecture/automation-studio.md`. I added a lasting-act paragraph after the defence-ledger paragraph. It covers:
  - the owner and the two sources;
  - the declared-consequences key;
  - the retry rule and `actUncertain` effects;
  - the effect checks (`skip_satisfied_node` and `checkEffect`);
  - how the web domain reads `lastingAct`.

  No Core source changed.

## Commands run and observed results

**Narrow test runner.** A scratch runner, `scratchpad/t361/run-ext-tests.mjs`, bundled the named test entries with the same esbuild options as `scripts/test-extension.mjs` and `domain/scripts/test-domain.mjs`. Its output went to `.test-build-scratch/t361-narrow`, which I deleted afterwards.

**Extension fail-first.** I put HEAD's `action-runner.ts` back and kept the new tests.
- `runtime/tests/action-runner.test.ts` printed `# tests 34 # pass 31 # fail 3`.
- The three failures were:
  - "a press whose send never reached the page fails saying it was not made…";
  - "a send addressed to a tab or frame the browser no longer has…";
  - "a read sent twice is unacted only when neither send reached the page".
- The new delivered-press test passes on HEAD too. It pins behaviour that should not change.

**Extension after the fix.**
- `action-runner.test.ts`: `# tests 34 # pass 34 # fail 0`.
- Every test under `src/runtime/tests` and `src/background/tests`: `# tests 336 # pass 336 # fail 0`, run again after the rename.
- One existing test changed its refusal from "No tab with id" to "Extension context invalidated.". "No tab with id" now counts as undelivered, and the test is about a refusal that is neither undelivered nor navigation.

**Domain fail-first.** I put HEAD's `run.ts` and `replay.ts` back and kept the helper and the new test file.
- Before I moved it, the file was `node-run/tests/uncertain-outcome.test.ts`. It printed `# tests 7 # pass 3 # fail 4`.
- The real failures were: exploration "not pressed again, and the model is told its outcome is uncertain"; exploration "any failure … told the same way"; and replay "the test is told its outcome is uncertain".
- The fourth failure was a defect in the test itself: an extract given by selector was refused before dispatch. I rewrote that test against the dispatch seam. It pins unchanged behaviour, so it passes on HEAD.

**Domain after the fix.**
- `uncertain-outcome.test.ts`: `# tests 7 # pass 7 # fail 0`.
- Every test under `llm-evidence/**/tests`, `runtime/tests` and `runtime/failure` (138 entries): `# tests 993 # pass 993 # fail 0`.
- After moving the test into `node-run/retries/tests/`, every `node-run/**` test: `# tests 285 # pass 285 # fail 0`.

**Typechecks and build:**
- `pnpm --filter @fluxiq-web-extension/domain check`: exit 0 ("core-build: … current with its source"; build-cache "stored").
- `pnpm --filter @fluxiq-web-extension/extension check`: exit 0.
- `pnpm --filter @fluxiq-web-extension/extension build`: "chrome: verified 22 files", "firefox: verified 22 files" plus the usual gecko.id placeholder warning, "e2e-chromium: verified 22 files".

**Audits:**
- Downstream `node scripts/structure-audit.mjs`, first run: two failures.
  - `directory-files`: `node-run/tests/` would hold 26 files, over the limit of 25. I moved the new test to `node-run/retries/tests/`, beside t359's `lasting-act.test.ts`.
  - `naming`: three `action-` files in `runtime/`. I renamed `action-delivery.ts` to `page-delivery.ts`.
- Downstream audit after those fixes, and again after the doc edits: `structure-audit: passed (176 warning(s), 257 baselined).` That is the same warning count t359 reported, and no new import cycle.
- Core `node scripts/structure-audit.mjs`: `structure-audit: passed (288 warning(s), 710 baselined).`

**`as never`.** No new casts. The only grep hits are the prose phrase "was never".

**Lab, provider-free.**
- Command: `FLUXIQ_LAB_INSTANCE=t361-lasting FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs run crossborder-marketplace --flow`.
- Result: run `run-muywm7me-55777c92`, `llm.mode: disabled, calls: 0`.
- Verdict: failed, `target_not_found`. That is the same cause as t355's and t359's runs, the recorded second coupon press, with the last four clicks taking about 4 s each as they are retried.
- In `snapshots/flow-lane.json`: "unacted" 7 times, `"effect":"ambiguous"` 0, "Outcome uncertain" 0, `web.transport.transient` 0, `web.action.rate_limited` 2. That matches t359's counts. No undelivered send happened in this run.
- Cleanup: `Get-CimInstance Win32_Process` filtered to node or chrome processes with `t361` in the command line printed "no t361 node/chrome processes".

**Not run:** full suites (twice-a-day rule), the Core vitest run (no Core source changed), and `pnpm docs:check` (only the hand-written architecture doc changed).

## Not verified

- **A real undelivered send in a live browser.** The stub reproduces Chrome's exact `lastError` words. The Lab scenario never produced "Receiving end does not exist" on a press, so the retry after a real one was not seen live.
- **Whether Firefox words "no such tab" or "no such frame" the way Chrome does.** Only "Receiving end does not exist" is known to be shared. Firefox's own wording for a missing tab or frame, if it differs, falls back to the old answer: uncertain, not retried.
- **Exploration and test replays live.** Both need a model. They are covered by provider-free tests through `createWebAutomationLlmEvidenceRuntime` with a stubbed gateway.
- **The chat card for `outcome_uncertain` in a live panel.** The follow-up covers it with a unit test only.

## Follow-up (coordinator request): one lasting-act definition in exploration and test replays; chat words

**What changed.**

- **`domain/src/runtime/lasting-act-statement.ts`** (new). `webLastingActStatement(actionType, parameters, reported, failure)` is the adapter's former private `lastingActStated`, moved here with the same body and made generic over the record type. It holds the domain's committing set, via `webPlanStepMustDeclare` imported from its owning file `plan-resolution/step-permission.ts`, and t355's rule for verification and confirmation failures. It is exported from the `runtime/` barrel.
- **`domain/src/runtime/adapter.ts`** calls it. The private copy and three imports that are now unused were removed, so there is one definition.
- **`node-run/retries/dispatch.ts`**:
  - The node now goes to Core the way a saved Flow's web node does. A read carries `metadata.effect: "observe"`, unchanged. A page-changing node carries only `{ [AUTOMATION_STUDIO_DECLARED_CONSEQUENCES_METADATA_KEY]: <the call's declared strings, [] for none> }`. The key is imported from `fluxiq/automation-studio`. The blanket `effect: "mutate"` marker is gone.
  - Each failure record is passed through `webLastingActStatement` before Core reads it.
  - Core's `automationStudioNodeActLasts` and gate 3 therefore see the same inputs as on the playback path: non-empty declared consequences, or the domain's `ambiguous` statement for click, keypress, dialog and type with submit.
  - The `node` parameter gained `declared`.
- **`run.ts` and `replay.ts`** pass `{ definitionId, effect, declared: value.consequences }`. `run.ts` stays at exactly 800 lines.
- **Core `packages/fluxiq/src/ui/activity-action/failure-reason.ts`**. This is outside t362's `runtime/activity/**` and `runtime/conversations/**`.
  - Added `outcome_uncertain` to `REFUSAL_REASONS`, with the words "FluxIQ couldn't tell whether it took effect, so it didn't do it again".
  - A test was added in `tests/failure-reason.test.ts`.
  - Core's `docs/reference/framework-reference.md` (both copies) was regenerated because one source line number shifted: `activityActionFailureReason` moved from line 159 to 164.
- **Docs.** Both architecture docs now describe the single definition and the chat words.

**Fail-first.** I put HEAD's `dispatch.ts` back and kept everything else.
- `retries/tests/uncertain-outcome.test.ts` printed `# tests 13 # pass 9 # fail 4`.
- The four failures were:
  - exploring plain typing typed again after an ambiguous failure, for each of transport-lost, `action_failed`, `page_changed` and `timeout`;
  - exploring navigate made again after `timeout` and then transport-lost;
  - replaying plain typing typed again;
  - the navigate dispatch-seam test with 4 attempts and no `lastingAct`.
- These pass on both versions, because they pin behaviour that should not change:
  - a submitting type with `send_or_publish` is not typed again and is reported `outcome_uncertain`;
  - a plain type that declared `modify_existing` is held back the same way;
  - the click tests.

Core fail-first: with HEAD's `failure-reason.ts`, `npx vitest run packages/fluxiq/src/ui/activity-action` printed `Tests 2 failed | 426 passed (428)`. The new test ran twice, because vitest also picked up a copy under `.tmp/core-web-build/`. With the fix it printed `20 passed (20)` files and `428 passed (428)` tests.

**After the fix:**
- `uncertain-outcome.test.ts` plus t359's `lasting-act.test.ts`: `# tests 20 # pass 20 # fail 0`.
- Domain `llm-evidence/**`, `runtime/tests` and `runtime/failure` (138 entries): `# tests 999 # pass 999 # fail 0`.
- Domain `src/io` and `src/output-nodes` (26 entries): `# tests 226 # pass 226 # fail 0`.
- Extension runtime and background tests: `# tests 336 # pass 336 # fail 0`.

**Checks and build:**
- Core `pnpm check` (packages/fluxiq): exit 0.
- Core library build (`pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`): exit 0. It was needed because the downstream checks first refused, saying "Core's build … is 35 minute(s) behind its source".
- Core `pnpm docs:check`: "Deterministic framework reference is current", after `pnpm docs:reference`.
- Domain check: exit 0. Extension check: exit 0.
- Extension build: exit 0, "verified 22 files" for chrome, firefox and e2e-chromium.

**Audits:**
- Downstream: `structure-audit: passed (176 warning(s), 257 baselined)`.
- Core: `structure-audit: passed (288 warning(s), 710 baselined)`.

**Not rerun:** the Lab run. On the playback path the adapter calls the same function with the same body, so behaviour there is unchanged.

**Behaviour now, on exploration and replay alike:**
- Plain typing, select, check, navigate, waits and reads keep the first attempt plus 3 retries after an ambiguous failure while they ran.
- A failure found after a non-committing page change, at verification or confirmation, is still not retried. That is t355's rule, the same as playback.
- Click, keypress, dialog, submitting type, and any call that declared a lasting consequence are held back when their outcome is uncertain, and reported as `outcome_uncertain`.

(The second bullet above was superseded by the next follow-up.)

## Second follow-up (coordinator request): verification and confirmation failures of acts that do not last are retried

**What changed.**

- **`domain/src/runtime/lasting-act-statement.ts`**: t355's rule is removed. A non-committing action used to get `retryable: false` when it failed at verification or confirmation; that no longer happens. The function now does only two things:
  - a committing act gets its `unacted` or `ambiguous` statement, as before;
  - any other action gets nothing beyond a client-stated `unacted`, and its record keeps its own `retryable`.
  The now-unused import of `webAutomationActionEffect` is gone. The docstring explains the change.
- **How declared consequences are honoured.** I did not teach the statement about declared consequences, and I did not set `retryable: false` for lasting acts. Core already holds both back as uncertain, which is better than a plain refusal:
  - a committing act: its `ambiguous` statement means `automationStudioAssessAttemptFault` gate 3 refuses it with `actUncertain`;
  - a non-committing step that declared a lasting consequence: Core reads `declaredConsequences` on the node (`automationStudioNodeActLasts`) and refuses it the same way.
  Marking these `retryable: false` would instead make Core refuse before any gate runs, so the result would not be flagged uncertain. The new test shows this: a plain type that declared `modify_existing` now ends `actUncertain` instead of being plainly refused.
- **Why this applies to every path.** Playback goes through the adapter and exploration and replays go through `dispatch.ts`, and both call this one function. Saved Flow web nodes carry no effect marker, so Core's gate 1, which blocks a failure found after the act, lets them through: their side-effect class is `none`, and that class counts as safe to repeat.
- **Tests updated:**
  - `runtime/tests/adapter-redaction.test.ts`: the sensitive plain type's `output_not_observed` is now `retryable: true`. It had pinned t355's rule.
  - A comment in `runtime/tests/adapter.test.ts` was updated.
- **Docs.** I updated the downstream `web-capabilities.md`, Core's `automation-studio.md`, and the header of `dispatch.ts`.

**Fail-first.** I put t355's two lines back in the statement, and its import.
- New `runtime/tests/lasting-act-statement.test.ts` plus `retries/tests/uncertain-outcome.test.ts` printed `# tests 20 # pass 15 # fail 5`. The five failures were:
  - plain type read-back mismatch, retryable and Core decides retry (playback decision via Core's public `automationStudioAssessAttemptFault`);
  - check, select and navigate verification failures retried;
  - the declared-consequence plain type, which was refused without `actUncertain`;
  - exploring plain type read-back mismatch typed again and succeeds;
  - check verification failure retried at the dispatch seam (3 sends, succeeded).
- The click tests pass on both versions, because they pin behaviour that should not change: a click whose confirmation failed is refused with `actUncertain` on playback, and in exploration is not pressed again and is reported `outcome_uncertain`.
- With the fix: `# tests 20 # pass 20 # fail 0`.

**Commands and results:**
- Every domain test entry (`find src -path "*/tests/*.test.ts"`): `# tests 1628 # pass 1628 # fail 0`. The first run showed 1 failure, the redaction test above, before I updated it.
- Extension runtime and background tests: `# tests 336 # pass 336 # fail 0`.
- Domain check: exit 0. Extension check: exit 0.
- Extension build: exit 0, "verified 22 files" for chrome, firefox and e2e-chromium.
- Downstream audit: `passed (176 warning(s), 257 baselined)`. Core audit: `passed (288 warning(s), 710 baselined)`.
- Core `pnpm docs:check`: "Deterministic framework reference is current". No Core source changed in this round.
- Lab, provider-free: `run-muyxtqss-b3bbdd5d` made 0 provider calls (`llm.mode: disabled`).
  - It failed the same way as before: `target_not_found` on the recorded second coupon press.
  - `flow-lane.json` had "unacted" 7, `"effect":"ambiguous"` 0, "Outcome uncertain" 0, `rate_limited` 2. That matches the earlier runs.
- Cleanup: no t361 node or chrome processes left.

## Open questions or contradictions found

1. Resolved by the follow-up: the chat now has words for `outcome_uncertain`.
2. Resolved by the follow-up: exploration and replay now use the playback definition. A declared consequence on a plain type still makes it lasting, because Core's definition counts any non-empty declaration.
3. **A click whose send was refused before delivery can still be judged by its landing.** `click-landing.ts` waits 300 ms for a navigation before rethrowing. If one commits in that window and lands on a robot check, the record says "the click itself was made", although the send never arrived. That behaviour is older than t361. It would only matter if another navigation happened to start in those 300 ms.
4. **Ownership note.** The brief named `background/**`, but the transport lives in `apps/extension/src/runtime/`. I also edited files outside the original Owns list: `domain/src/runtime/llm-evidence/tool-rejection.ts`, for the new reason; and, in the follow-up, `domain/src/runtime/adapter.ts`, `runtime/index.ts`, the new `runtime/lasting-act-statement.ts`, `node-run/retries/dispatch.ts`, and Core `ui/activity-action/failure-reason.ts` with its test and the regenerated framework reference; in the second follow-up, `domain/src/runtime/tests/adapter-redaction.test.ts`. t362 owns none of them.
5. **The in-page recovery loop is narrower than the node loop.** Inside a single attempt, the extension's own recovery loop retries mutating verbs only for a target miss before dispatch. Every node-level retry now follows the user's rule. That in-page loop is a separate, sub-second cushion inside one attempt, and I did not change it.
