# t407: a check or choice that navigates its page reads its state, not a lost reply

Worker report. Tree `C:/Users/osrs_/FluxStuff/fxwork/t407-navigating-check-reply`, branch
`task/t407-navigating-check-reply`, uncommitted.

## Outcome

Done. One check is still open: the Lab row 3 run was blocked before a browser opened (see Not verified).

When a `web.dom.check` or `web.dom.select` sent to the top frame loses its reply because the page unloaded
under the delivered message, and a top-frame navigation committed, the background now:

1. judges the landing as it judges a press's (robot check, 429/503, other 400+), using the words "check" or "choice"
   instead of "click";
2. reads the requested state on the new document with the fact check's own message
   (`fluxiq.evaluateFacts`, `checked` for a check and `value equals` for a choice by value or label);
3. reports one of three results:
   - `landed`: succeeded, with passed validation;
   - `not_landed`: failed `web.validation.output_not_observed`, retryable. This is the verb's own read-back failure.
   - `unknown`: failed `web.action.failed`, retryable, which is the same code as before t407, but now the record
     says why.

Press behaviour is unchanged. All 73 existing and new click-landing tests pass, and every existing press assertion
holds without edits.

## What changed and why

- `apps/extension/src/runtime/click-landing.ts`
  - `pressMayLand` became `landingKind(action, frameId)`, which returns `press` or `state`. `state` applies only to
    check and select in the top frame, because only the top frame's navigation is watched and the state is read from
    the top document.
  - New `sendStateCheckingLanding`:
    - A reply that arrives is returned untouched, with no 300 ms grace and no page reads.
    - An error that is not "message channel closed" (undelivered, or refused) rethrows at once.
    - A lost reply with no commit rethrows unchanged, as today.
    - Otherwise it runs `judgeLanding`, then `readRequestedState`.
  - `judgeLanding` and the outcome builders (`checkLandingOutcome`, `rateLimitedLandingOutcome`,
    `refusedLandingOutcome`, `returnWords`) take an `ActNoun`. Presses pass `"click"`, so their strings are
    byte-identical.
  - `EXPECTED` became `expectedLanding(noun)`.
  - Added `requestedStateOutcome`.
  - Updated the file comment.
  - The exported name `sendClickCheckingLanding` is kept, to avoid churn in the three existing test files. It has a
    new optional trailing parameter `frameId` (default 0).
- `apps/extension/src/runtime/action-runner.ts`: passes `targetFrameId` to `sendClickCheckingLanding`. This is the
  only change there.
- New `apps/extension/src/runtime/requested-state/`:
  - `read-requested-state.ts`: `readRequestedState(action, tabId, access, budgetMs = 2500)`.
    - It settles the tab, then asks the fact check every 150 ms until the answer is `true` or the budget runs out.
      It keeps asking after a `false` answer because a page may draw its filters after it loads.
    - `false` about a described element is `not_landed`. `false` with no element (the control is missing from the
      new page) is `unknown`.
    - A choice by index, or an action with no target, is `unknown` without asking the page.
    - It reuses `runFactCheck`. The target is `selector` plus `element`, falling back to `options.element` as the
      resolver does.
    - It never quotes the value or option.
  - `index.ts`: the barrel.
  - I made a new directory because `runtime/` already holds 24 files against a budget of 25.
- Tests:
  - `runtime/requested-state/tests/read-requested-state.test.ts`: 11 tests.
  - `runtime/tests/click-landing-state.test.ts`: 11 tests, covering:
    - landed, not landed and unknown;
    - a choice;
    - a robot check and a 403, both in a check's words;
    - no navigation, which rethrows;
    - undelivered, which rethrows without the grace;
    - a reply that arrived, which returns at once;
    - a child frame, which rethrows;
    - a click's lost reply, which is still judged as a press.

## Commands run and observed results

- `cd apps/extension && npx tsc -p tsconfig.json --noEmit` produced no output (it passed).
- `EXTENSION_TEST_BUILD_LABEL=t407 node scripts/test-extension.mjs runtime/tests runtime/requested-state/tests content/actions`
  reported `# tests 521 # pass 520 # fail 1`.
  - The one failure was `content/action-runtime/tests/assertion-evaluation.test.ts` "the wait is real...", which I did
    not touch (the `content/actions` filter also matches `content/action-runtime`). It took 6.7 s under load.
  - Re-running it alone gave `# tests 7 # pass 7 # fail 0`.
- `EXTENSION_TEST_BUILD_LABEL=t407 node scripts/test-extension.mjs runtime/requested-state runtime/tests/click-landing`
  reported `# tests 73 # pass 73 # fail 0`.
- `node scripts/test-content.mjs e2e/content/tests/check-assert.spec.ts` reported `14 passed (29.5s)`. This only
  regression-checks the content-side check verb, which I did not change.
- `pnpm build` (apps/extension) printed `chrome: verified 22 files`, `firefox: verified 22 files` and
  `e2e-chromium: verified 22 files`.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (184 warning(s), 651 baselined)`.
  - click-landing.ts is now 668 lines, which is past the 400-line advisory threshold but under the hard limit of 800.
  - action-runner.ts is 499 lines.
- `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --row 3`:
  - First attempt: it refused because the shared Core `fxwork/!FluxIQ` is detached 1 commit behind dev. I did not
    sync it, because the brief says the shared Core is read-only.
  - Retried with `FLUXIQ_LAB_ALLOW_BEHIND_CORE=1`: run `rmx-2026-10-10T07-31-06-167Z-ca81fb` returned case 3
    `blocked` with "The script names 1 element(s) by an evidence handle (today-filter), which a hand-authored Flow has
    no exploration to resolve". No browser was started.

## Not verified

- Whether the five false first-attempt failures are gone in a real run. Row 3 is blocked at compile in this tree
  (this is probably what t406 addresses), so no Lab browser exercised the new path.
- That Chromium actually delivers the fact-check reply from the reloaded bigbox document within the 2.5 s budget.
  The unit tests stub the sender.
- Firefox behaviour. Firefox keeps no `responseStatus`, but the state read does not depend on it.
- No full suites were run, as the brief says.

## Open questions or contradictions found

- The brief says "the same honest failure as today when it is not". I report `not_landed` as
  OUTPUT_NOT_OBSERVED (retryable): the control is there and does not hold the state, which is the code the check verb
  itself reports when its read-back mismatches. I report `unknown` as `web.action.failed` (retryable), which is the
  code a lost reply had before. I did not use wire status `unknown` / `web.action.unknown`, because that code is
  non-retryable and ambiguous. The interrupted-action precedent (`domain/src/client/interrupted-action/outcome.ts`)
  answers a non-committing act with `failed` instead. Change this if the supervisor wants status `unknown`.
- A plain `web.dom.type` (without submit) and `web.dom.clear` that navigate are not covered. Only check and select are.
- A check in a child frame keeps today's behaviour (it rethrows).
- Row 3's run is blocked at compile in this tree, while t404's run (`rmx-...30bb9a`) got as far as the check steps.
  The two trees' matrix scripts may differ.
