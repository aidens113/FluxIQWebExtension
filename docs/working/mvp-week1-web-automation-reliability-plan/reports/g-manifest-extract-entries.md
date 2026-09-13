# g-manifest-extract-entries — H6 (scenario-lab)

## Outcome

**Done.** Both unreachable `web.dom.extract` entries are gone from `expected.actions`.
- **Tests:** each scenario's test pins the corrected actions, and a mutation proof
  covers both pins.
- **Recording lane:** its extraction checks are unchanged.
- **Gates:** scenario-lab `check` exit 0; scenario-lab tests 204 of 204 from a
  private build.
- **Structure audit:** exit 1, on two violations in the shared working documents
  only, which this change does not touch. See "Commands run".

**Re-verified at `eb8bf99` before editing: not already settled.**
- **The entries:** `git status` showed all four owned files clean. The entries sat
  at `infinite-feed/scenario.ts:50` and `multi-tab/manifest.ts:41`.
- **Not covered by the earlier decision:** the twenty-third dispatch's extraction
  decision (`g-flow-lane-expectations`) gave only `expected.extracted` a
  `not_applicable` path (`packages/test-runner/src/flow-lane/expectations.ts:62-65,76`).
  `assertFlowActions` (`expectations.ts:7-20`) still judges every
  `expected.actions` entry, at `flow-lane/run-flow-lane.ts:153`.

## What changed and why

**`apps/scenario-lab/src/scenarios/infinite-feed/scenario.ts`** (W11)
- **Actions:** `expected.actions` is now `[{ action: "web.dom.scroll", outcome: "succeeded" }]`,
  with a one-line comment giving the reason.
- **Unchanged:** the recording script's `extract-loaded-posts` step,
  `expected.extracted` (40), and `finalState`.
- **The `end-early` variant** declares no `actions`, so it inherits the corrected
  list. The existing test pins that inheritance
  (`resolved.expected.actions` deep-equals `manifest.expected.actions`).

**`apps/scenario-lab/src/scenarios/multi-tab/manifest.ts`** (W15)
- **Actions:** `expected.actions` is now `[{ action: "web.dom.click", outcome: "succeeded" }]`,
  with the same comment.
- **Unchanged:** the `extract-order-details` step and `expected.extracted`,
  PO-4472's record.
- **The `popup-blocked` variant** declares its own `[{ action: "web.dom.click" }]`,
  and was not touched. How an entry with no outcome is judged is H4's
  (`g-bench-expectation-fixes`).

**Tests**
- **`infinite-feed/tests/scenario.test.ts`:** the manifest test now also asserts
  `manifest.expected.actions` deep-equals the scroll-only list. It sits next to the
  existing pins of the extract step and `extracted`, count 40.
- **`multi-tab/tests/scenario.test.ts`:** the W15 manifest test now also asserts
  `manifest.expected.actions` deep-equals the click-only list. It sits next to the
  existing pins of `extracted` and each extract field's selector.

**Why the recording lane's extraction checks are unaffected.**
- **Where the lane judges extraction:** `run-scenario.ts:294`, with
  `assertExtraction(recordingWorkflow.expected.extracted, step.id, extracted)`,
  for each extract step in the recording script.
- **What it never reads:** `expected.actions`, in that call and in
  `assertRecordedEvents` (`:298`).
- **Every reader of `expected.actions` in test-runner:**
  - `run-flow-lane.ts:153`, the Flow lane;
  - `run-scenario.ts:226` and `:252`, the `existing` and `clone` target modes;
  - `scenarios.ts:26`, `scenarioRequiresCore`.
- **Core is still required:** both manifests keep a non-empty `actions` list and
  `recordingEvents`, so `scenarioRequiresCore` is still true for both.

### What each row's Flow lane now asserts

This comes from `run-scenario.ts:290-302,322-367` and `run-flow-lane.ts:136-155`.

**First, the recording phase.** Every Flow-lane run first runs the recording
script. That phase still asserts:
- the extract step's records;
- the recording events;
- the final state.

**Then the lane itself:**

| Row | Failure (`assertFlowFailure`) | Actions (`assertFlowActions`, some attempt matches) | Extraction | Final state after the Flow (`run-scenario.ts:366`) |
| --- | --- | --- | --- | --- |
| W11 primary | none may be reported | `web.dom.scroll` with status `succeeded` | `not_applicable`, published as `extractionExpectation` in `snapshots/flow-lane.json`; not judged | "Showing 40 posts"; `feed-page-4` exists; `feed-page-5` absent; `feed-end` not visible |
| W11 `end-early` | none may be reported | `web.dom.scroll` `succeeded` (inherited) | `not_applicable` (25 expected); not judged | "Showing all 25 posts"; `feed-end` visible; `feed-page-4` absent |
| W15 primary | none may be reported | `web.dom.click` `succeeded` | `not_applicable`; not judged | path `/scenarios/multi-tab/`; `reviewed-po-4472` reads "Reviewed"; `review-result` reads "PO-4472 review confirmed." |
| W15 `popup-blocked` | `output_not_observed` | `web.dom.click` with no outcome (H4 decides) | `not_expected` (`extracted: []`) | path `/scenarios/multi-tab/`; the pop-up-blocked notice; `reviewed-po-4472` absent |

**The proposal-coverage check** (`assertProposalCoversRecording`) pins nothing on
any of these rows, because neither manifest gives a `count` on its recording
events.

**W15 primary still fails on the Flow lane,** on P4, before any of this is reached:
the confirm click does not run on the order list (`i-bench-triage`). This change
removes its next failure, the one after P4.

## Commands run and observed results

**1. Type check.** `pnpm check` in `apps/scenario-lab` gave `exit=0`
(`tsc -p tsconfig.json --noEmit`, no diagnostics).

**2. Private build and full suite.**
- **Why not `pnpm test`:** it runs `pnpm build` into the shared `dist/`, and another
  worker is editing scenario-lab files at the same time.
- **Instead:** the build script's own override, at `dist`'s depth:
  `FLUXIQ_LAB_SCENARIO_OUT_DIR=F:/!FluxIQWebExtension/apps/scenario-lab/dist-g-manifest-extract-entries node scripts/build-scenario-lab.mjs`
  gave `build exit=0`.
- `node --test "dist-g-manifest-extract-entries/**/*.test.js"` gave `test exit=0`,
  with `# tests 204`, `# pass 204` and `# fail 0`.
- **The four tests in scope:** `ok 90 - manifest is valid and scripts W11 ...`,
  `ok 91 - end-early variant is armed ...`,
  `ok 147 - the manifest is a valid W15 workflow ...` and
  `ok 148 - popup-blocked is armed ...`.

**3. Mutation proof.**
- **Hashes, taken after the correction and before mutating:**
  - `infinite-feed/scenario.ts`: `febd3003bf32475d589a71ca0aa231ebdc413b5d78279290ba2b1e7ad275f28f`;
  - `multi-tab/manifest.ts`: `5ded6e2785ed28acef8c8af48d8f37d35c8a36d6d7ea10dddd9c8ce08e616e92`.
- **Mutation:** the `{ action: "web.dom.extract", outcome: "succeeded" }` entry put
  back into both manifests. The rebuild gave `build exit=0`.
- **The two test files alone** gave `test exit=1`, with `# pass 12` and `# fail 2`:
  - `not ok 1 - manifest is valid and scripts W11 as three page-sized scrolls, page waits, and an extract of 40 posts`,
    with "Expected values to be strictly deep-equal". The actual list held a second
    element, `action: 'web.dom.extract'`, `outcome: 'succeeded'`; the expected list
    held only `web.dom.scroll`.
  - `not ok 8 - the manifest is a valid W15 workflow whose every target exists where its step runs`,
    with the same diff, where the expected list held only `web.dom.click`.
  - Every other test in both files passed, including `end-early` and
    `popup-blocked`.
- **Restore:** both entries removed again. `sha256sum -c` gave
  `infinite-feed/scenario.ts: OK`, `multi-tab/manifest.ts: OK` and
  `hash exit=0`, so both files are byte-identical to the corrected versions.

**4. After the restore.** The private rebuild gave `build exit=0`. The full suite
gave `test exit=0`, with `# tests 204`, `# pass 204`, `# fail 0` and no
`not ok` lines.

**5. Structure audit.** `node scripts/structure-audit.mjs` from the repository
root gave `audit exit=1`, "structure-audit: 2 violation(s) across 1 rule(s)".
- **The two failures,** both `[working-docs]` and both shared documents I must not
  edit:
  - `docs/working/mvp-week1-web-automation-reliability-plan.md`: 819 lines
    exceeds the 800-line compaction threshold.
  - `docs/working/README.md` is out of date with the documents' header blocks.
- **The only scenario-lab line:** an advisory `warn [directory-files]
  apps/scenario-lab/e2e/: 18 source files`. It is not a failure and not an owned
  path.
- **None of my four files is named.**

**6. Cleanup.** The private build directory was removed (`cleanup exit=0`).
`git status --short -- apps/scenario-lab` shows my four files and the auth-gate
files, which belong to another worker. The `git diff` of the owned files is 8
insertions and 2 deletions.
- **Line endings:** git warns "LF will be replaced by CRLF" on the four files.
  The diff contains only the intended lines, so line endings did not change.

## Not verified

**No Lab run** (none is allowed in this dispatch). A Lab run must show:
- **W11, both variants:**
  - `lab run infinite-feed --flow`, primary and `end-early`, both pass;
  - `snapshots/flow-lane.json` reads `extractionExpectation: "not_applicable"`, and
    its actions include `web.dom.scroll` `succeeded`;
  - no `action.dispatch` failure reading "The Flow did not produce a
    web.dom.extract action".
- **W15 primary on the Flow lane** still fails on P4 until P4 is fixed. Once P4
  is fixed, it must not fail on any extract expectation.
- **The recording lane** for both rows still passes its extraction:
  `recordCount` 40 or 25 for W11, and 1, PO-4472, for W15.

**The `existing` and `clone` target modes** (`run-scenario.ts:226,252`) also
receive `expected.actions`.
- **Consequence:** for these two scenarios, a hand-built persisted Flow is no
  longer required to run an extract action.
- **Not checked:** whether either mode is ever used with these scenarios. Not
  exercised.

**Not run:**
- the test-runner suite. No test-runner file pins these manifests' actions: a
  search of `web.dom.extract` in scenario-lab source finds only the three
  manifest entries named here and below, and test-runner mentions these
  scenarios only as corpus row ids and tab URLs;
- root `pnpm check`, the content harness, `pnpm build`, and the scenario-lab e2e
  specs.

## Open questions or contradictions found

1. **A third unreachable entry, outside this brief.**
   - **Where:** `apps/scenario-lab/src/scenarios/admin-console/manifest.ts:143`.
     The `extract-customer-list` workflow pins
     `{ action: "web.dom.extract", outcome: "succeeded" }` as its only action. Its
     recording script is only an extract step and a checkpoint.
   - **Effect:** it is unreachable on the Flow lane for the same reason.
   - **Scope:** it is not a week1 bench row (`bench/corpus/week1.ts` has no
     admin-console row; W09 is `data-table`), so it was left alone.
   - **If briefed:** removing it leaves that workflow with no actions and no
     recording events. Check how that interacts with H2's `scenarioRequiresCore`
     change.
2. **Nothing stops the next manifest doing the same.**
   - **Option in the runner:** judge a `web.dom.extract` or
     `web.dom.extract_list` entry in `expected.actions` exactly as `extracted` is
     judged: `not_applicable` when the Flow has no extract node. That covers every
     manifest at once, admin-console included. It lives in
     `flow-lane/expectations.ts`, which `g-bench-expectation-fixes` owns.
   - **Option in the validator:** a rule in `packages/test-contracts/src/validation.ts`.
     It would have to allow the `existing` and `clone` modes, where a hand-built
     Flow can extract.
   - **Decision needed from the supervisor:** whether either belongs in Week 1, to
     enforce this mechanically.
3. **H4 owns W15 `popup-blocked`'s `[{ action: "web.dom.click" }]`,** which has no
   outcome. Left unchanged.
