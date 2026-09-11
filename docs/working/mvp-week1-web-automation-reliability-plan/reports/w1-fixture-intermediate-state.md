# Report: w1-fixture-intermediate-state

Worker report for the `### Brief: w1-fixture-intermediate-state` brief in
`briefs/wave-1.md` (corpus row W24). This is a claim for the supervisor to
verify.

## Outcome

Partial. Everything this fixture owns is built and passes: the unit tests pass
9/9 and the page spec passed 2/2. The Scenario Lab build is blocked by another
worker's file, `src/scenarios/data-table/table-page.ts` (owner
`w1-fixture-data-table`), which fails with TS1487 at 15:49 and 16:50. At
runtime the same syntax error stops the registry from loading. Until it is
fixed, the corpus-wide registry and server tests, and every page spec that
imports the server (mine included), cannot load.

I rebuilt once, as the brief asks, and rechecked at 12:48. Running
`pnpm exec tsc -p tsconfig.json --noEmit` in `apps/scenario-lab` still printed
only those two errors (exit 2), and the file had not changed since 12:43:47.
Once it is fixed, rerun:

1. `pnpm --filter @fluxiq-web-extension/scenario-lab build`
2. `node --test apps/scenario-lab/dist/scenarios/intermediate-state/tests/scenario.test.js`
3. `node --test apps/scenario-lab/dist/tests/registry.test.js apps/scenario-lab/dist/tests/server.test.js`
4. `pnpm --filter @fluxiq-web-extension/scenario-lab exec playwright test -c e2e/playwright.config.ts e2e/intermediate-state.spec.ts`

## What changed and why

Files (all inside the brief's ownership):

- `apps/scenario-lab/src/scenarios/intermediate-state/scenario.ts`: replaces the
  placeholder. The export name `intermediateStateScenario`, id, seed `122`, start
  path `/scenarios/intermediate-state/`, and manifest title "Intermediate state"
  are unchanged; the page's own title is "Submit an expense claim".
- `apps/scenario-lab/src/scenarios/intermediate-state/tests/scenario.test.ts`
  (new): 9 node:test cases.
- `apps/scenario-lab/e2e/intermediate-state.spec.ts` (new): 2 Playwright tests.

### The fixture

- **Start page:** an expense-claim form (`claim-form`) with two labelled text
  fields, "Employee name" (`employee-name`) and "Amount (USD)" (`claim-amount`),
  and a "Submit claim" button (`submit-claim`). It has headings, a
  `role="alert"` error line, and a polite live region (`claim-progress`).
- **Processing interstitial:** submitting hides the form and inserts
  `processing` (the heading "Processing your claim" plus an indeterminate
  `<progress>`). The page then waits a fixed `PROCESSING_DELAY_MS = 800`, a
  constant never derived from the seed or the clock, and asks the server what
  comes next (`finish-processing`).
- **Baseline result:** the page inserts `claim-result` (`result-status` "Submitted for
  review", `result-reference`, `result-employee`, `result-amount`) and focuses its
  heading "Claim submitted".
- **`unannounced` mode:** instead of the result, the page inserts
  `confirmation-step`, which contains the heading "Confirm your claim", a labelled
  checkbox "I confirm these details are accurate" (`confirm-details`), and a
  Continue button (`continue`). It focuses the heading. Pressing Continue without
  the box ticked shows "Confirm the details to continue." (`confirmation-error`,
  `role="alert"`). With the box ticked, `confirm` completes the claim and the
  normal result appears.
- **Nothing appears before the server says so:** the processing, confirmation,
  and result nodes do not exist in the DOM until the server reports that phase,
  and the start page is byte-identical in both modes (unit-tested). A baseline
  recording therefore never sees confirmation markup, and no hidden node can
  satisfy a wait for `claim-result` early, whether the wait checks existence or
  visibility.
- **State, the oracle at `/__control/final-state`:**
  - `reference`: `EXP-` followed by the seed mod 100000, zero-padded to five
    digits. This is the only seed-derived content: seed 122 gives `EXP-00122`.
  - `mode`: `baseline | unannounced`.
  - `phase`: `idle | processing | awaiting-confirmation | complete`.
  - `claim`: `{ employee, amount }`, with the amount normalized to two
    decimals.
  - `submissionCount`, `confirmationCount`, `completionCount`.
- **`mutate` operations** (all pure; unknown operations and bad payloads return
  the state unchanged):
  - `submit {employee, amount}`: validates the claim and moves it to
    `processing`.
  - `finish-processing`: from `processing`, moves to `complete` in baseline
    mode or to `awaiting-confirmation` in `unannounced` mode.
  - `confirm {confirmed: true}`: from `awaiting-confirmation`, moves to
    `complete`.
  - `set-mode {mode}`: the variant's arm.
- **No `route`:** the fixture serves no subpath documents; the unit test asserts
  `route === undefined`.

### Workflows and variants

| Workflow / variant | Corpus row | Script or arm | Expected outcome |
| --- | --- | --- | --- |
| primary | W24 | 1. type `testid:employee-name` "Ada Lovelace"<br>2. type `testid:claim-amount` "42.50"<br>3. click `testid:submit-claim`<br>4. `waitForState` `testid:claim-result`, `timeoutMs` 5000<br>5. checkpoint | **Success.**<br>`pageFacts`: `claim-form` visible.<br>`recordingEvents`: `web.element.input_changed` ×2, `web.element.clicked` ×1, `web.dom.mutated` (no count).<br>`actions`: `web.dom.type`, `web.dom.click`, and `web.dom.wait_for_selector`, all succeeded.<br>`finalState`: `result-status` "Submitted for review", `result-employee` "Ada Lovelace", `result-amount` "$42.50", `confirmation-step` does not exist.<br>`allowedConsoleErrors`: `[]`. |
| primary → `unannounced` | W24 (variant) | arm `set-mode` `{ mode: "unannounced" }` | **Failure `OUTPUT_NOT_OBSERVED`.**<br>`actions`: `web.dom.type` succeeded, `web.dom.click` (any outcome).<br>`finalState`: `confirmation-step` visible, `claim-result` does not exist.<br>Inherited unchanged: `pageFacts`, `recordingEvents`, `allowedConsoleErrors`. |

No `workflows[]` entries: W24 is the fixture's only corpus row.

### Corpus decisions I had to make

1. **The arm clears the in-flight claim.** `set-mode` also sets `phase: "idle"`
   and `claim: null`, and keeps every count. Without this, the recording's
   `complete` would stay in the oracle after an armed run that never submits,
   which would read as a false success. Page behaviour is unaffected: the
   start page never shows a leftover result.
2. **No `extract` step.** The brief says the workflow "verifies" the result. I
   verify through `finalState` facts on the rendered result (status, employee,
   amount) and do not add an extraction, so W24 measures waiting and the
   unannounced step rather than whether Flows support extraction. If the corpus
   row needs the Flow itself to read the result, add an `extract` of
   `testid:claim-result` with fields `[data-testid="result-employee"]` and so on.
3. **Recording fields versus run fields in the variant.** The variant overrides
   only what describes the armed run (`actions`, `finalState`, `failure`) and
   inherits what describes the recording (`pageFacts`, `recordingEvents`),
   because recording happens before arming. This assumes the runner checks
   recording expectations against the recording and run expectations against
   the armed run. The contract does not say this; see the open questions.
4. **The variant's click has no outcome.** Phase 1.4 or 1.5 decides whether the
   unobserved result is charged to the click, through outcome validation, or
   to the wait that follows. Asserting either one would tie the fixture to that
   choice, so the variant pins only the category.
5. **`OUTPUT_NOT_OBSERVED`, not `TIMEOUT`.** On the browser path, the recorded
   wait for `claim-result` runs out its timeout because a step the recording
   never saw is blocking it. The brief's category holds only if Phase 1.5
   classifies that case as `OUTPUT_NOT_OBSERVED`.
6. **Expectations are seed-independent.** The reference number is derived from
   the seed but appears in no manifest expectation, so the manifest holds under
   any `--seed`. The runner defaults to the manifest seed (122).
7. **Recording-event expectations are borrowed.** They follow `basic-form` (two
   fills give `input_changed` ×2; one click gives `clicked` ×1) and `delayed-ui`
   (an uncounted `web.dom.mutated` plus a `wait_for_selector` action for a
   delayed element). They have not been checked against the live recorder.

## Commands run and observed results

- Structure audit, before any change (`node scripts/structure-audit.mjs`):
  exit 1. It printed two FAIL lines, both about working documents: the plan is
  824 lines, and `docs/working/README.md` is out of date. It also printed
  "structure-audit: 1 baseline entries can be lowered".
- Structure audit, after my files (`node scripts/structure-audit.mjs`): exit 0,
  "structure-audit: passed (27 warning(s), 19 baselined)". No line names
  `scenario-lab` or `intermediate-state`. "1 baseline entries can be lowered"
  is still printed; it predates my change and is not mine.
- Scenario Lab build, run twice
  (`pnpm --filter @fluxiq-web-extension/scenario-lab build`): exit 2 both times.
  The only errors were
  `src/scenarios/data-table/table-page.ts(15,49)` and `(16,50)`:
  `error TS1487: Octal escape sequences are not allowed`.
- Unit tests, run twice
  (`node --test apps/scenario-lab/dist/scenarios/intermediate-state/tests/scenario.test.js`):
  tsc emits even with errors, and the dist held my new test names. Both runs:
  `# tests 9`, `# pass 9`, `# fail 0`.
- Page spec, from `apps/scenario-lab`:
  `pnpm exec playwright test -c e2e/playwright.config.ts e2e/intermediate-state.spec.ts --reporter=list --output <scratchpad dir>`.
  Result: "2 passed (8.2s)"; the primary took 1.5s and the variant 6.7s.
  - This is the brief's command, run from the package directory. The two extra
    flags only stop the run from writing the shared
    `apps/scenario-lab/e2e/test-results/`, which other fixture workers were
    writing to at the same time.
  - The spec itself reads the manifest: it drives the manifest's own
    `recordingScript` and checks the manifest's own `pageFacts` and
    `finalState`, using the runner's meanings for `text`, `visible`, and
    `exists`.
  - It checks that the processing interstitial is shown and the result is
    absent right after the click, and that the result appears no less than
    700 ms after the click.
  - It checks the `/__control/final-state` state, that no console errors
    occur, and that the network guard stays clean.
  - For the variant it records, arms through `POST /api/intermediate-state/set-mode`,
    and reruns the script. The recorded `waitForState` step then times out
    after its full 5000 ms. The variant's `finalState` facts hold, and the
    state reports `awaiting-confirmation`. Finally it completes the unrecorded
    step by hand: Continue without the box shows the error; with the box
    ticked the result appears.
- The same page spec with `--repeat-each=3`, run twice: exit 1. Neither run
  loaded because of
  `SyntaxError: ...data-table\table-page.ts: Invalid escape sequence in template. (15:49)`,
  followed by "No tests found".
- Corpus tests
  (`node --test apps/scenario-lab/dist/tests/registry.test.js apps/scenario-lab/dist/tests/server.test.js`):
  both failed at load with
  `SyntaxError: Octal escape sequences are not allowed in template strings`, at
  `dist/scenarios/data-table/table-page.js:12`.
- Type check of the e2e spec
  (`tsc -p <scratchpad>/w1-intermediate-tsconfig.e2e.json`, which extends the
  package tsconfig and includes only my spec): it reported only the same
  data-table TS1487 errors and none in my files.

## Not verified

- A clean Scenario Lab build, and the corpus registry and server tests with my
  manifest loaded. The data-table syntax error blocks both. The unit test does
  validate the manifest with `validateWebScenario`, and the registry test's
  corpus rules hold by construction (unique seed 122 and start path, default
  `screenshots: "events"`, a semantic step, and a non-empty `expected`).
- Repeat stability of the page spec, which passed once.
- The live recording lane (`pnpm lab run intermediate-state --target isolated`).
  The step and assertion support it needs is still being written by
  `w1-runner-asserts`, so the `recordingEvents` and `actions` expectations have
  not been checked against the real recorder and Flow.
- Whether FluxIQ reports `OUTPUT_NOT_OBSERVED`. The category is a declaration;
  the browser path does not produce categories until Phase 1.5.

## Open questions or contradictions found

- **The blocker.** `data-table/table-page.ts` lines 15–16 put the CSS escapes
  `\25B2` and `\25BC` inside a JS template literal. That is a syntax error in
  both tsc and Node, and it takes the whole registry down with it. The owner is
  `w1-fixture-data-table`. Writing `\\25B2`, or the literal characters, fixes
  it.
- **Contract gap.** `ScenarioVariant` says each field of `expected` replaces the
  workflow's, but not which fields the runner checks against the recording and
  which against the armed run. Decision 3 depends on the answer. It is worth
  one sentence in the `ScenarioVariant` comment, and the runner should apply
  the same split.
