# t968: an act that changed nothing is not a success

Outcome: Partial. Worker report (worker-heavy). Extension worktree `fxwork/t968/!FluxIQWebExtension`, Core worktree
`fxwork/t968/!FluxIQ`. Nothing committed.

## Outcome

**Partial: code and unit checks done; the Lab proof is blocked by a defect on dev that is outside t968.**

- **The fix.** The run's false success was a click whose reply was lost when the check page navigated by
  itself, which the worker counted as the click navigating (`runtime/click-landing.ts:239-255`). The act
  mark fixes it at the root. The lead decided (2026-11-19) to keep the act mark, to add no landing check
  for Enter, and to make rung 1 its own later unit.
- **What passed.** The targeted tsc is clean, and the unit tests pass in both repositories.
- **The blocker.** Lab case 14 cannot run. Every recovery-matrix case errors before its Flow starts:
  case 1, which none of my changes touch, fails the same way (below).

## Cause (step 1)

### The run

The run the user watched is lane A's `run-mwohvt8n-a57cad8a` (auction-marketplace,
`auction-marketplace-lens-hood-seller-shop`; the brief's `run-mwoi785f-ebe09067` is lane B's job-board
run, which met no check). The saved Flow is: s1 navigate home, s2 type "Kestrel 35 lens hood" with
`submit`, s3 click the listing link, s4 click the seller's shop link, s5 read the shop.

The fixture sends the fourth results page of a session to its bot check
(`apps/scenario-lab/src/scenarios/auction-marketplace/route.ts:44`, `CHALLENGE_AFTER_VIEWS = 3`): a page
headed "Checking your browser before you continue" that calls `location.replace(returnTo)` by itself five
seconds after it loads (`client/challenge-script.ts:12`). Attempt 1 (exploration), 2 and 3 (replays) used
three results views, so attempt 4's s2 landed on the check.

Step log (`lab-runs/2026-11-19/run-mwohvt8n-a57cad8a/steps`):

| Step | Node | Time (local, s) | Result | What happened |
| --- | --- | --- | --- | --- |
| 0037 | s2 type + Enter | 30.88-31.38 | succeeded, 500 ms | Enter sent the search form; the server answered with the check page. No landing wait. |
| 0038 | s3 click | 31.39-35.53 | `web.target.not_found` | The listing link is not on the check page; the content script looked for 3.8 s. |
| 0039 | s3 click, retry | 35.54-37.05 | **succeeded** | `page.click` 35.59-36.13. **No `pressed` span**, unlike every other click in the run. |
| 0040-0043 | s4 click x4 | 37.05-61.0 | `web.target.not_found` | The tab is on the results page (0045's look shows it), not the listing. |

So the click "succeeded" without being made: the check page's own timer navigated the tab while the
click command was still waiting for its target, and the worker took that navigation for the click's.

### Where success was decided

- **Lost reply counted as a landed click.** `apps/extension/src/runtime/click-landing.ts:239-255`
  (`sendClickCheckingLanding`): when the content script's reply is lost because its page unloaded
  (`navigating-page.ts:29`, "message port closed before a response was received") and a top-frame
  navigation committed, a landing nothing speaks against returns `navigatedBeforeAnsweringOutcome()`
  (`click-landing.ts:666`, "The click navigated its page before it could answer"). The only test is that
  the message was delivered (`unloadedUnderDeliveredMessage`), never that the press was dispatched. A
  command still resolving its target, on a page that navigates by itself (a self-clearing check, a
  timed redirect, a meta refresh), reads as a click that navigated. The domain's timing records `pressed`
  only from the result's `actedAt` (`domain/src/runtime/llm-evidence/node-run/timing/timing.ts:94`); the
  lost-reply result has none, which is why 0039 alone has no `pressed` span.
- **Type + Enter skips its landing.** `content/actions/type.ts:107-117` returns as soon as Enter is
  sent. Enter submits through `form.requestSubmit` (`keyboard/implicit-submission.ts`), and a form
  submission's navigation starts in a later task, so `navigation-watch/watch.ts` has not seen it when
  `execute.ts:205` reads it. The worker then reads `began: false`, takes `pageSawNoNavigation`
  (`click-landing.ts:475`, task speed S10) and waits for no landing (`startWindowMs = 0`), so the robot
  check that 0037 landed on was never read or waited out (`landed-check-wait.ts`). Not proven from the
  logs (the step folder holds only spans), but it is the only path that answers in 500 ms here.
- **What `expectation` and `recorded-effect` do in a Flow run.** Core `engine/automation/node-execution/attempt.ts:279-280`:
  `expectation` (`transitions/comparison.ts:130`) reads only a declared `done when:`; with none it
  returns at once, hence `expectation 0`. `recorded-effect` (`node-execution/recorded-effect.ts:65`) runs
  only for a lasting act (`automationStudioNodeActLasts`) without a `done when:`. A navigation click is
  neither, so nothing after the act's own answer judged s3.
- **`press.settle`** (`domain/src/runtime/llm-evidence/node-run/run.ts:493`) is exploration only: a press
  that changed nothing is settled once before its page view is drawn. It is never on a Flow-run path,
  hence `press.settle 0` in the speed lines.
- **`actLanded`** (`domain/src/runtime/act-landing/landing.ts:51`, Core
  `engine/automation/defensive/host-act-landed.ts:24`) is asked only after a lasting act's answer was
  lost (C6 effect check), and only for a press: `landed` when the pressed control is gone. It is never
  asked about a click that answered `succeeded`.
- **The click verb's own answer watch** (`content/actions/click.ts:392-460`,
  `action-runtime/ignored-press/`) reads signs only inside the pressed control's section, and fails a
  silent press only on a command control (`expectsAnswer`, `click.ts:691`); a press on anything else that
  changed nothing passes on its hit test (`hitTestValidation`).

## Plan (step 2), as revised twice by the lead mid-task

**The user's rule (2026-11-19, relayed by the lead): state-based recovery "should ONLY kick in when a
step fails, so we can try and get it back on track deterministically, then via LLM. But we should NOT be
measuring expected output of an action on every single action just normally, since that creates a lot of
problems."** So part A (a before/after change check on every act) is dropped, and successful steps pay
nothing extra. A swallowed press is caught when a later step fails, and the ladder then runs,
deterministic first:

1. **Locate where the run really is.** Compare the page with the recorded page states around the recent
   steps; a page still in the state before an earlier act means that act did not land, and the run
   resumes from it, unless it is a lasting act whose effect is uncertain (never repeated; state recovery
   or the model instead).
2. **Interruption facts** (robot check, consent, modal): wait it out or hand it to the person-check
   handling, then retry.
3. **Refind the target from its source step.**
4. **State routing** to the node matching the page.
5. **Model repair** (in-run, carrying on; in answer-first, the explore fallback).

**What exists for each rung, read from Core (not changed unless said):**

- Rung 1 is almost what state routing already decides on a failed step whose act provably did not happen
  (`engine/automation/state-routing/decision.ts:107`): it observes the page once, compares it with every
  step's recorded starting page (`routeSignatures.before`), and goes back to an earlier step that already
  acted only when its recorded effect (`routeSignatures.after`) no longer matches (`decision.ts:139-147`).
  Two gaps, from the code: an acted step with **no recorded `after`** is always taken as landed
  (`decision.ts:142`, `!signatures.after` counts as "effect stands"), so a swallowed press on such a step
  is never resumed; and it only runs at the `state-route` stage, not as a separate first rung. In the
  incident each of s4's four `state-route` stages took 0-1 ms (steps 0040-0043), so the page was never
  observed: no candidate offered a recorded starting page (`no_pre_states`) or the decision returned
  before observing. Which one is **not verified**: the live step folder keeps only spans, not the
  attempt's `stateRouting` record.
- Rung 2 exists in the extension for a target missing on a page that is a person-only check
  (`content/action-runtime/results.ts:561`, `challengeGateFailure`); a self-clearing check is "waited out
  by the retry a missing target is given" (`challenge-evidence.ts:80`), not by an explicit wait.
- Rung 3 exists (`engine/automation/target-reacquire/`), before the last retry, for a lost target.
  Extended here to a certain-no-effect failure (below).
- Rungs 4 and 5 exist (`step-loop/state-route.ts`, `step-loop/incident-repair.ts`; answer-first's explore
  fallback).

**Built in this task, after the revision:**

1. **Root cause of the false success: a lost reply is a press only if the page says it pressed** (the
   act mark, extension). This changes a report only for a press that was never dispatched: the page went
   away by itself while the command was still looking for its target, and the click reported "navigated
   before it could answer". It now fails `web.page.changed`, `unacted`, retryable, so the failure is the
   step's own and the ladder runs on it. It reads nothing on the page. Its cost on a successful press is
   one fire-and-forget extension message from the content script, and a listener in the worker; the
   worker reads the mark only when the reply was lost. **The lead should confirm this is acceptable under
   the rule** ("acts report as they do today"): it measures no output, but it does add that message.
2. **Rung 3 for a press that certainly did nothing** (Core, `target-reacquire/stale-failure.ts`): a
   `certainNoEffect` failure (the click verb's existing `web.action.no_effect`) counts as a stale target
   for the re-acquire before the last retry. It runs only on a failed attempt.
3. **Proof case (Lab):** matrix row 14, case `14`, auction-marketplace under a new `browser-check-first`
   variant (the bot check stops the very first results page and lets the visitor on after five seconds),
   the lens-hood seller-shop Flow, check `act-effect-honest` (no model call, the run succeeds, and no
   step answers success only for the next one never to find its target), site expectation
   `auction-check-passed`. This reproduces the incident; it does **not** prove rung 1, because with the
   act mark the click fails itself rather than the next step.

**Not built (needs the lead's decision or a further brief):**

- **Rung 1 as its own rung, and the "click swallowed by an overlay" Lab case that shows the next step
  failing and the run resuming from the pre-click state.** The design point it turns on is evidence I do
  not have: why the incident's state routing never observed the page. The recorded states rung 1 needs
  must be the accepted run's (the Flow's `routeSignatures`), not this run's own looks: in the incident
  the look taken after s3 already showed the results page (the page moved by itself), so this run's own
  before/after pair says s3 landed; only the build's recorded `after` for s3 (the listing page) shows it
  did not. Hand-authored matrix Flows carry no `routeSignatures` (no exploration), so such a case must
  come from a recorded build, not `flows/*.ts`. Suggested next brief: (a) rerun case 14 or an
  answer-first replay with the attempt trace kept, and read s4's `stateRouting.outcome`; (b) if
  `no_pre_states`, find why answer-first's saved steps lack `before` (`answer-first/attempt/draft-save.ts`
  `routeSignaturesOf`); if `no_match` with `matching_steps_already_acted`, the `decision.ts:142` rule is
  the cause, and a non-lasting step with no recorded `after` may be resumed when the page matches its
  `before`.
- **Proof that a successful run makes no extra page reads.** What this task leaves on a successful step:
  no page capture, fact read, element read, wait or routing; one extension message per press (the mark).
  The content test `act-mark/tests/act-mark.test.ts` shows the first act only posts the mark. A whole-run
  count of page reads was not made.

**Withdrawn under the rule:**

- Part A, the act-effect watch (`content/action-runtime/act-effect/`, wired in `actions/execute.ts`,
  with a page-wide scope added to `ignored-press/page-press-listener.ts`): deleted, and both files are
  back to HEAD.
- A submit-aware navigation watch that made the worker read the landing after a successful Enter (so the
  check s2 landed on would have been waited out at s2): reverted, `navigation-watch/` matches HEAD. The
  cause it answered stays and is recorded above: a typed entry sent with Enter answers before its form's
  navigation starts, so its landing is not read (`click-landing.ts:475`).

## What changed and why

Extension (`fxwork/t968/!FluxIQWebExtension`):

- `apps/extension/src/shared/act-mark-message.ts` (new): the mark message.
- `apps/extension/src/content/action-runtime/act-mark/` (new): the page's sender. `acted-at/acted-at.ts`
  runs a `first` hook on an action's first note (made by every act primitive before it dispatches);
  `execute-action.ts`, `actions/execute.ts` and `message-handler.ts` thread `actMark` through;
  `action-runtime/index.ts` exports the sender.
- `apps/extension/src/runtime/act-mark/` (new): the worker's watch. `runtime/click-landing.ts` refuses
  an unmarked lost reply (`wentBeforeActOutcome`: `web.page.changed`, or a person-only check, both
  `unacted`) and exports `pressJudgedByLanding`; `runtime/action-runner.ts` makes the watch for a press
  and carries its token.
- `apps/scenario-lab/src/scenarios/auction-marketplace/`: mode `browser-check-first` (`types.ts`,
  `route.ts`), the seller-shop workflow's `browser-check-first` variant (`breadth/seller-shop.ts`).
- `packages/test-runner/src/recovery-matrix/`: row 14 (`matrix-rows.ts`, `matrix-row.ts`), Flow
  `flows/hood-seller-shop.ts`, check `act-effect-honest` (`checks/matrix-checks.ts`), site expectation
  `auction-check-passed` (`records/site-state.ts`), `--row` accepts 14 (`command.ts`).
- Docs: `docs/architecture/extension-client.md` (the act mark), `failure-taxonomy.md` (`PAGE_CHANGED`'s
  second producer, the check record when the page went by itself, Core's refind of a certain no-effect
  act), `web-capabilities.md` (Click row: the lost reply).
- Tests: `content/action-runtime/act-mark/tests/act-mark.test.ts` (3), `runtime/act-mark/tests/watch.test.ts`
  (3), `runtime/tests/click-landing.test.ts` (+3), auction `tests/scenario.test.ts` (+1), matrix
  `tests/matrix-rows.test.ts` (row 14 counts), `tests/command.test.ts` (+1),
  `checks/tests/matrix-checks.test.ts` (+2), `records/tests/site-state.test.ts` (+1).

Core (`fxwork/t968/!FluxIQ`):

- `packages/fluxiq/src/engine/automation/target-reacquire/stale-failure.ts`: a `certainNoEffect`
  failure counts as a stale target for the re-acquire before the last retry; a test row in
  `target-reacquire/tests/stale-failure.test.ts`.
- `docs/architecture/automation-studio.md`: the re-acquire paragraph says so.

No protocol type changed: `actMark` rides beside the action in the extension-internal `executeAction`
message, and `web.page.changed` with `unacted` was already in the closed set with a Core consumer.
Nothing in `answer-first/{attempt,completion}/**` or `runtime/result-verification/**` was touched.

## Commands run and observed results

Every run went through `fxwork/.heavy-slots/heavy-slot.mjs`; most waited 15-60 minutes in its queue,
and three earlier runs were killed by my own 900 s wrapper while still queued (re-queued with longer caps).

- Extension unit tests, after part A was removed:
  `EXTENSION_TEST_BUILD_LABEL=t968 node heavy-slot.mjs run t968-e2c -- node apps/extension/scripts/test-extension.mjs src/content/action-runtime/act-mark src/content/action-runtime/acted-at src/content/actions src/runtime/act-mark src/runtime/tests/click-landing.test.ts src/runtime/tests/click-landing-state.test.ts src/runtime/tests/click-landing-rate-limited.test.ts src/runtime/tests/click-landing-new-tab.test.ts`
  -> `# tests 341`, `# pass 341`, `# fail 0`.
- Core: `node heavy-slot.mjs run t968-core2 -- (packages/fluxiq) node ../../node_modules/vitest/vitest.mjs run src/engine/automation/target-reacquire src/engine/automation/step-loop/tests`
  -> `Test Files 8 passed (8)`, `Tests 39 passed (39)`.
- Structure audit, extension: `node scripts/structure-audit.mjs` -> `structure-audit: passed (255 warning(s), 551 baselined)`.
  The first run, with part A and the worker watch in `runtime/`, failed four rules (`runtime/` and
  `runtime/tests/` over 25 files, two unexplained `catch` blocks); those were fixed before part A was
  removed, and the audit then passed. Not re-run after the removal, which only deleted files.
- Structure audit, Core: `node scripts/structure-audit.mjs` -> `structure-audit: passed (557 warning(s), 911 baselined)`.
- Targeted tsc on the changed extension files (a scratch tsconfig extending `apps/extension/tsconfig.test.json`
  with only those files): the first run found 2 errors, both in my new `click-landing.test.ts` rows
  (`validation.actual` unnarrowed, TS2339 at lines 605 and 636). Fixed; the re-run (with
  `click-landing.test.ts` after it) was queued as `t968-tsc4` and never got a slot (below).
- Matrix and scenario-lab unit tests (bundled with esbuild into a scratch folder, since the packages'
  own `test` scripts build whole packages): `matrix-checks.test.ts` and `site-state.test.ts` passed
  (19 of 21); `matrix-rows.test.ts` and `command.test.ts` failed to load only because the scratch bundle
  could not find `scripts/provider-secret-environment.mjs` by its own URL (a harness artifact, not a
  test failure). The re-run with that file copied beside the bundles (`t968-lab4`) never got a slot,
  and neither did `scenario.test.ts` (auction's new row), which the first run never reached.
- Lab case 14: `pnpm lab recovery-matrix --case 14` first refused a stale Core build (my Core change);
  after `pnpm --filter fluxiq build` and `pnpm --filter @fluxiq/ui-components build` it built the
  downstream packages (`scenario-lab:build`, `domain:build`, `extension:build`, `browser-host:build`,
  `test-runner:build`, 170 s) and refused to start because a model provider key was set in the shell
  (`A recovery-matrix case runs with no model provider credential in its environment`). Re-run with the
  keys unset (`t968-matrix-14c`) never got a slot.
- From about 22:20 the heavy-slot queue did not move for about 50 minutes: free memory stayed at
  0.3-2.0 GB, under the 2.5 GB a slot needs, with `t905-merge-judge-related` holding the slot. I stopped
  my three queued runs, so that nobody would be holding a place in line for results no one reads.
  Commands to re-run, all from `fxwork/.heavy-slots` with `node heavy-slot.mjs run <label> -- ...`:
  - `node <ext>/node_modules/typescript/bin/tsc -p <scratchpad>/tsconfig.t968-ext.json`. The scratch
    config extends `apps/extension/tsconfig.test.json`, sets `typeRoots` to the package's and the root's
    `@types`, and lists the 13 changed extension files.
  - `EXTENSION_TEST_BUILD_LABEL=t968 node apps/extension/scripts/test-extension.mjs src/runtime/tests/click-landing.test.ts`.
  - The matrix and auction tests: the package `test` scripts (`pnpm --filter @fluxiq-web-extension/test-runner test`,
    `pnpm --filter @fluxiq-web-extension/scenario-lab test`), or my scratch bundler
    `<scratchpad>/t968-bundle-tests.mjs <package root> <test files>`.
  - `env -u CLAUDE_API_KEY -u DEEPSEEK_API_KEY -u ANTHROPIC_API_KEY pnpm lab recovery-matrix --case 14`
    (Core and the downstream packages are already built for it in the t968 worktrees).

- **Final runs, after the lead's decisions** (all through `fxwork/.heavy-slots/heavy-slot.mjs`):
  - Targeted tsc, then `click-landing.test.ts` (`t968-tsc5`): `TSC-CLEAN`; `# tests 39`, `# pass 39`, `# fail 0`.
  - Recovery-matrix unit tests (`matrix-rows`, `command`, `matrix-checks`, `site-state`, `t968-lab5`):
    `# tests 29`, `# pass 29`, `# fail 0`.
  - Auction `scenario.test.ts` (`t968-lab5`): 9 of 10. The failure was the manifest test that pins the
    variant list, which the new `browser-check-first` variant extends. I updated the pin; the re-run
    (`t968-lab6`) gave `# tests 10`, `# pass 10`, `# fail 0`.
  - Lab case 14, three attempts:
    - `t968-matrix-14d`: refused, because the provider keys come from the worktree's `.env.local`.
      Unsetting the shell variables is not enough: the CLI loads the file.
    - `t968-matrix-14e`: run with `FLUXIQ_PROVIDER_KEY_FILES=none FLUXIQ_TEST_ENV_FILES=none`, the
      switches `scripts/lab/provider-free-run.mjs` uses for scripted runs; `recovery-matrix` does not set
      them itself.
    - `t968-matrix-14f`: the same, plus `FLUXIQ_TEST_TARGET=isolated`.
    - Both 14e and 14f: `{"caseId":"14","verdict":"error","reasons":["runtime.behavior: Deterministic
      browser network policy blocked 1 unexpected destination(s):
      request:http://127.0.0.1:3000/.well-known/fluxiq"]}`. The Flow compiled (4 steps, s1-s4), `run: null`.
  - Control, Lab case 1 the same way (`t968-matrix-1`): the same error, word for word. The matrix fails
    for every case, independently of t968.
  - Cause of the block, from the code: the extension's hosted connect flow (`background/connect/pkce/`,
    added in 487483302 on 2026-11-14) reads discovery from `DEFAULT_CORE_API_URL = "http://127.0.0.1:3000"`
    (`shared/constants.ts:2`). The Lab's deterministic network policy refuses that destination. No
    recovery-matrix run exists anywhere since 2026-10-10.

## Not verified

- **Lab case 14 in a browser.** Blocked by the matrix-wide defect above. So neither the incident path end
  to end (the act mark failing the unmade click, then a retry after the check passes) nor the new fixture
  variant and Flow selectors are proven in a browser. Once the block is fixed:
  `env -u CLAUDE_API_KEY -u DEEPSEEK_API_KEY FLUXIQ_PROVIDER_KEY_FILES=none FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated pnpm lab recovery-matrix --case 14`
  (everything is built in the t968 worktrees).
- **The act mark in a real browser.** Both sides have unit tests, but no browser run proves the message
  arrives before a cross-document unload. The design relies on it being posted synchronously before the
  press is dispatched.
- **Firefox.** Not considered: it keeps no response status, so its landing is not judged. The act mark
  uses `chrome.runtime`, as the existing next-page mark does.

## Open questions or contradictions found

1. **Resolved by the lead: keep the act mark.** Was: **The act mark under the rule.** It is not an output measurement. It changes a report only when the
   press was never dispatched, and it costs one extension message per press on success. The lead said
   "acts report as they do today"; keeping it, or dropping it in favour of rung 1, is the lead's call.
   Without it, the incident's s3 still reports success.
2. **Now its own later unit, rung 1 (lead).** **Why state routing never observed the page in the incident** (0-1 ms `state-route`). This decides
   rung 1's design: `no_pre_states` (the answer-first Flow lacks `routeSignatures.before`), or
   `decision.ts:142` (an acted step with no recorded `after` taken as landed). Getting this needs the
   attempt trace's `stateRouting` record from a replay.
3. **Rung 1 needs the build's recorded states, not this run's looks.** In the incident, this run's own
   look after s3 already showed the results page, so a before/after pair from the run says s3 landed.
   Only the build's recorded effect for s3 (the listing page) shows that it did not.
4. **Resolved by the lead: no landing check for Enter; a bad landing surfaces at the next step.** Was: **Type + Enter skips its landing** (`click-landing.ts:475` with `navigation-watch/`): a form's
   navigation starts after the action has answered. The fix was withdrawn under the rule, but the
   incident's s2 answered "text entered" while landing on a robot check. Whether to judge s2's landing
   is the lead's call.
5. The brief named `run-mwoi785f-ebe09067` as lane A's latest. That run is lane B's (job-board) and met no
   check. The run with the browser check is lane A's `run-mwohvt8n-a57cad8a`.
6. **New: the recovery matrix cannot run on dev.** Since 487483302 the extension asks
   `127.0.0.1:3000/.well-known/fluxiq`, and the Lab's deterministic network policy blocks it, so every case
   errors before its Flow starts (cases 1 and 14 shown). Separately, `lab recovery-matrix` refuses to run
   while the worktree's `.env.local` holds provider keys, and does not switch the env files off as the
   scripted `attempt` path does. Both need a unit of their own (extension connect, or the Lab's allowed
   destinations, and the runner's environment).
