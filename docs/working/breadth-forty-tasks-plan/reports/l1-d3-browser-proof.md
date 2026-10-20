# l1-d3-browser-proof: provider-free browser proof of the reset settlement

Worker report for brief `l1-d3-browser-proof`. Downstream worktree `fxwork/t724/!FluxIQWebExtension`, paired Core
`fxwork/t724/!FluxIQ` (read only). Nothing committed. Every run used the scripted provider: zero model calls, no Lab
live run, nothing paid. Every run was headed, on the installed MV3 extension, the real Core gateway and the public
project service.

## Outcome

Partial. Two of the three new cases found product defects (rule 3), so I stopped those cases and recorded them.

- The two existing cases pass on the new code with no spec change.
- Job shapes D+F pass.
- Office shape C passes.
- Office shape E fails on a Core defect.
- Photo shape G fails on a domain/extension defect.

The two defective cases keep the design's assertions unchanged and are marked `test.fail(...)`, with the defect named
in the test and its header. They run headed on every run. Once a defect is fixed, Playwright reports "expected to
fail but passed", so the marker must then be removed.

## What changed and why

All changes are under `apps/extension/e2e/site-reset/`.

### Shared harness

The harness was moved out of the existing spec into focused modules, one export each, all exported from `index.ts`:

| Module | Exports | What it does |
| --- | --- | --- |
| `installed-build.ts` | `startInstalledBuild` | Temporary FluxIQ root, Core, gateway, Lab and page; `pair()`; `close()` with the old cleanup-scope guard; `rootDir`. |
| `instrumented-runtime.ts` | `bindInstrumentedRuntime`, `digest` | Records start-state reads, permission declarations, tool outcomes and click dispatches. |
| `scripted-provider.ts` | `bindScriptedProvider` | Supervisor plan, dispatch and complete; every verification answers yes; each builder turn is the spec's script. |
| `project-build.ts` | `projectBuild` | Creates the project, flow and instruction; runs the build; `stop()` cancels it. |
| `page-view.ts` | `pageHandle`, `pageHandleWhere`, `handleBefore`, `rowControl`, `rowTitles` | Finds controls by words the page view printed. |
| `store-opening.ts` | `openStoreDetail` | The everything-store opening, shared by two specs. |
| `trial-answers.ts` | `actsUnder`, `startedWithActs`, `trialCode` | Reads acts and verdicts from trial answers. |
| `diagnostic.ts` | `keepDiagnostic` | Attaches the diagnostic to the report and writes it to the test's output folder. |

Details:

- **Instrumented runtime.** Reads now also carry `location`, `scope` and the domain's `controls`. Declarations also
  carry `dialog`, `place` and `state`.
- **`page-view.ts`.** `handleBefore` finds the control `label` whose next control is `next`, such as the post's own
  Like before its Comment.

### Existing spec

`tests/installed-project.spec.ts` was rewritten onto the harness. Its builder script and every assertion are
unchanged. It went from 412 lines to 285, and the audit's 400-line advisory for it is gone.

### New specs

**`tests/office-buy-now.spec.ts`** (everything-store). One build helper `runOfficeBuild(trials)` and two tests:

- **Shape C, passes.** The steps:
  1. The cart is read and `destination-N` is issued.
  2. Buy Now is pressed declaring `create_new` with that ref.
  3. The subflow is submitted and tested.

  Asserted:
  - Exactly one Core look (`site-reset.look.N.arrival`, declaring `[]`) before the test.
  - The trial is admitted with verdict yes. `startedWith.cannotUndo` is `[buy]`, worded "nothing it could change
    showed a change".
  - The trial's own Buy Now step succeeded.
  - No undo call was made, and no click after the press.
  - Every cart read equals the baseline digest.
- **Shape E, `test.fail`.** The same build, plus a visit to the product page and a second test. It asserts the
  design: two admitted trials, one Core look before each, and both acts listed as left unchanged.

**`tests/job-failed-save.spec.ts`** (job-board), passes. The steps:

1. My jobs is read: a plain `<ol>` with two rows and no aria set attributes. `destination-1` is issued.
2. The job's heart is pressed on its own page, declared `modify_existing`. The board fails the first save itself.
3. Test 1 is refused `candidate.trial_reset_required`. The act's `settle` names `resetDestination` and
   `destination-1 (2 items at …/myjobs)`.
4. "Unsave job" on Product Designer (saved before the build), under `undoes`, is refused `candidate.undo_unproved`.
   It was declared `permitted: false`, its subject is in the original list, and no click was dispatched.
5. A navigation to My jobs under `undoes` with `resetDestination: destination-1` lands.
6. Test 2 is admitted with verdict yes and no acts to undo or restore. Its "save the job" step succeeded.

Every My jobs read equals the baseline digest.

**`tests/photo-toggle.spec.ts`** (photo-social), `test.fail`. The steps:

1. The studio profile is opened, and the first unpinned grid cell is opened. Its dialog is over the profile.
2. The post's own Like is pressed, declared `modify_existing`.
3. The subflow is submitted and tested.
4. The next post's Like is pressed under `undoes`.
5. Unlike is pressed on the post's own page under `undoes`.
6. The next test.

It asserts the design: `place` and `state` on the declarations; reads whose `controls` show the state change; a
`settle` saying to press the control back; another post's control refused unrun with no click; Unlike admitted at
the same place in another state and dispatched once, with the post showing Like; the next test admitted.

## Commands run and observed results

Every Playwright run was from `apps/extension`, with `NODE_OPTIONS=--no-experimental-strip-types` (reason below).

| Command | Observed result |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/extension test:e2e:build` | exit 0. "core-build: FluxIQ Core's build … is current"; bundles built. |
| `npx playwright test -c e2e/playwright.config.ts e2e/site-reset/tests/installed-project.spec.ts` (Node 22.23.3, no flag) | "SyntaxError: TypeScript parameter property is not supported in strip-only mode", "No tests found". |
| Same command, with the flag, before any change | `2 passed (2.4m)`. New-row inverse 1.6m; failed save versus retry inverse 2.0m. |
| `npx tsc -p tsconfig.test.json --noEmit` (includes `e2e/**`) | exit 0, no output. Run after the harness and again after the final edits. |
| `node scripts/structure-audit.mjs` (repository root) | `structure-audit: passed (212 warning(s), 638 baselined)`. No site-reset warning. |
| Final: `npx playwright test -c e2e/playwright.config.ts e2e/site-reset/tests/ --workers=3` | exit 0, `6 passed (5.0m)`. Details below. |

The final run's six results:

| Case | Result | Duration |
| --- | --- | --- |
| job D+F | ok | 49.9s |
| new-row inverse | ok | 1.2m |
| failed save versus retry | ok | 1.7m |
| office C | ok | 55.9s |
| office E | expected failure (x) | 56.1s |
| photo G | expected failure (x) | 58.3s |

### The expected failures fail at the defect

`test.fail` would also accept an unrelated failure, so I checked each saved diagnostic (in my scratchpad, folder
`d3-run11`).

- **Office E:** tests `["yes", "candidate.trial_reset_required"]`, Core looks before each test `[1, 0]`. The second
  refusal lists only `act-2` "trial step 2 … on "Buy Now"", with the "name that list's ref" settle.
- **Photo G:**
  - The Like and the Unlike both declare state `p:3baa0f17…` at the same place.
  - The Unlike was refused `candidate.undo_unproved`, with no click.
  - Test 1's settle is the "name that list's ref" sentence, not the toggle sentence.
  - The captured drawn buttons have `accessibleName: null` and `visibleText: null`, with only a `drawing` id.

### Intermediate runs (my own errors, fixed)

- An over-strict office check: Core's look is a navigation that declares `[]`.
- A bad regex.
- The wrong photo grid-cell lookup: the cells print `~/p/<code>/`.
- A wrong assumption that a trial's clicks pass through the runtime's `executeAction`. They do not, so trial presses
  are proved from the trial feedback steps instead.

### Environment failures, not product

- One run died at start with Windows code 0xC0000142 in every worker, after I stopped a run.
- One photo run hit a 30 s timeout while setting up the extension session.

## Defects found (diagnosis; product source not edited)

### 1. Office shape E (Core)

**The step that fails:** the second test after the first trial. It is refused `candidate.trial_reset_required`, and
Core makes no look.

**Evidence:**

- Trial 1's `leftOnSite` lists act-1 (`buy`) and act-2 ("trial step 2 … on "Buy Now"").
- The trial step's recorded diff spot matches the explored press on every token the matcher checks:
  - subject `s:f347…` and page `s:f347…`;
  - resource digest `bbcebd36…`, the same as the explored press;
  - definition id `web.output.dom-click`, equal to the explored call's node;
  - consequences `[create_new]` on both.
- Even so, act-2 got no destination.

**Diagnosis:**

- In a single-subflow plan the builder's test is the judged whole run.
- `service/project-build/whole-trials.ts` (lines 66-71) records that run's acts in the supervisor's ledger
  (`ledger.forBrief(AUTOMATION_STUDIO_PROJECT_BUILD_SUPERVISOR_LEDGER).trialRan(result.acts, …)`).
- `site-reset/ledger.ts` `trialRan` matches repeats only against its own ledger's explored acts. The supervisor's
  ledger holds none, so `settlement-trial-repeat` never links act-2 to act-1.
- The builder's own ledger never records the trial act at all.

This is shape E on the real site whenever a plan has one subflow. The fix belongs in Core: either record a builder's
whole-run acts in the builder's ledger, or match repeats across the project's ledgers.

**Not confirmed by direct instrumentation:** I could not read the act's owner from the stored records (my probe found
none in `project.sqlite`). The diagnosis rests on that code path plus the answers above.

### 2. Photo shape G (domain/extension)

**The step that fails:** the toggle never forms. As a result:

- test 1's settle is the "name a list" sentence;
- the Unlike under `undoes` is refused `candidate.undo_unproved`;
- every later test is refused, and the build ends `flow_bootstrap.evidence_repeat_without_progress`.

**Evidence:**

- The Like and the Unlike declare the same `state` token at the same `place`.
- In the dialog, the reads at that place show identical counts before and after the press. The post did become liked.
- The raw capture of the post's action buttons (`div role=button` holding an `svg aria-label`) has
  `accessibleName: null` and `visibleText: null`, with only `drawing: "d1.…"`. The page view still prints "Like" and
  "Unlike" for them.

**Diagnosis:** `domain/src/runtime/llm-evidence/control-spot/state.ts` digests `element.name`, which is empty for
controls drawn only as an icon. The fix is one of these, or both:

- the state takes the words the page view prints, from the drawing's label;
- the extension's accessible-name capture includes a descendant `svg[aria-label]`, as accessible-name computation
  does.

**Second observation:** in the dialog, the post's Like and the comments' Likes share one place (9 controls in one
state). With real names, the count rule (exactly one control changing) would still tell them apart.

## Not verified

- No live or Lab run; this was provider-free only.
- Office E and photo G past their defects. Their remaining design assertions (both acts listed; Unlike admitted and
  the next test admitted) have never run green.
- The owner of the office trial act in the stored ledger, which I could not observe directly.
- The full e2e suite and other e2e folders were not run, per the twice-a-day rule.
- `chromium-baseline` and Firefox were not run. These cases use the Chromium extension fixture only.

## Open questions or contradictions found

1. **Job: the look settles the press `restored`, not `unchanged`.**
   - The domain declares a navigation as effect `mutate` with no consequences (`node-run/replay.ts:261`).
   - Core's `ledger.ts` `explored()` therefore counts a navigation under `undoes` (admitted `on: "moving"`) as a
     landed undo: `attempts += 1`, and the clock advances.
   - The act then settles `restored` (marked undone). It is left out of the next trial's `startedWith` and
     `leftOnSite`, so the judge is not told the save was left.
   - Core's shape-E test models that look as `observe`, and expects `unchanged`.

   The site is unharmed and the brief's "settles it" holds, so the job assertions check only the settlement (trial
   admitted, nothing to undo or restore). They pin neither wording. The supervisor should decide whether a no-lasting
   navigation under `undoes` should count as an undo attempt.
2. **Node 22.23.3 strips TypeScript by default.** The site-reset specs (and the other installed specs that load Core
   source) need `NODE_OPTIONS=--no-experimental-strip-types`, the same workaround `scripts/test-content.mjs` applies.
   `e2e/playwright.config.ts` does not set it, so `pnpm test:e2e` would fail to load them on this Node.
3. **Using `test.fail` for known defects is my choice.** It keeps the design's assertions running headed, but it also
   accepts a failure at any earlier step. The supervisor may prefer `test.fixme`, or leaving the cases failing.
4. **Brief order versus the run.** In the job case I pressed the undo on the pre-existing job before the settling
   look, while the act was still open. That is the stronger refusal. The brief listed it after the look.
