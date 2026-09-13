# g-lane-consistency — every lane reads an expected action the same way, and a bad manifest is fixture.invalid

Worker report, 2026-09-13. Brief: `briefs/finish-week1.md`, twenty-ninth dispatch.
Source findings: `reports/g-expected-action-guard.md` open questions 1 and 2, and
`reports/g-bench-expectation-fixes.md` H4.

## Outcome

Done.
- **One rule for every lane.** The existing and clone lanes now call the Flow lane's
  `assertFlowActions`. They no longer keep a second copy of the check.
- **A manifest the validator rejects** now fails as `fixture.invalid`, whether the
  registry rejects it on import or the runner's own check does. The message names
  each issue's path and the validator's wording, and never a value from the page.
- **Question 3 is answered below**, from the code only. Nothing was changed for it.
- **Four mutation proofs** were run. Each was caught, and each file was restored
  byte-identical.
- **Gates:** the test-runner `check`, its full suite in a private `--outDir`, and the
  structure audit all pass.
- **No Lab run** was made, because the brief forbids one.

Re-verified at HEAD first. Both defects were still present:
- `existing-flow-run.ts:107` read `expected.outcome ?? "succeeded"`;
- `scenarios.ts:11` imported the registry with no handling, so a
  `ContractValidationError` reached `classifyRunnerFailure` (`failure.ts:63-68`) as
  `unknown`.

## What changed and why

### 1. The existing and clone lanes use the Flow lane's rule (`packages/test-runner/src/existing-flow-run.ts`)

- **The inline loop is replaced** (formerly lines 106-113) by
  `assertFlowActions(expectedActions, expectationAttempts(actions, actionTypes))`.
- **`expectationAttempts`** is a new private helper, and it replaces the private
  `actionTypeOf`. It converts the attempts through `flowActionTimings`
  (`run-manifest/action-timings.ts`), the conversion `run.json` already records:
  - the action type is the output the node dispatches, or else the definition id,
    which is the same rule `actionTypeOf` had;
  - the status passes through `runActionStatus`, the vocabulary the Flow lane judges
    (`flow-lane/persisted-flow-run.ts:194`);
  - `failure: null` fills a field the check never reads.
- **The attempt's type is still passed through `safeId`,** as this module did for
  every id it names in a message. An expected action is always a valid id, so the
  sanitising can never turn a match into a mismatch.
- **The shapes allowed the call.** `assertFlowActions` reads only `actionType` and
  `status`, so the file I do not own did not need to change.

The message on these lanes is now the Flow lane's own:
- before: `Persisted FluxIQ Flow did not produce expected X action outcome Y; it produced …`;
- now: `The Flow did not produce a X action[ with outcome Y]; it produced …`, with
  `details.expected` and `details.observed`, and `expectedOutcome` only when an
  outcome was declared.

A grep of the repository, with `dist`, `build`, archives, reports and briefs
excluded, found no other reader of the old wording.

### 2. A rejected manifest fails as `fixture.invalid` (`packages/test-runner/src/scenarios.ts`)

- **`asFixtureDefect`, a private helper,** wraps both the registry import and the
  loop that calls `assertWebScenario`.
  - **A contract rejection** becomes
    `RunnerFailure("fixture.invalid", "Scenario Lab manifest failed contract validation: <path>: <message>; …")`.
    It keeps `cause`, and `details.issuePaths` lists the issue paths.
  - **Every other error is rethrown unchanged.** A registry that imports a missing
    module still classifies as `environment.missing`, and a crash stays what it was.
- **The message holds only each issue's `path` and `message`,** never the error's own
  `message` text. The validator's wording quotes at most an identifier the manifest
  declares: an action type (`validation.ts:198`), an extract field key or a record
  field key. It never quotes a typed value, an expected record or a fact value.
- **`contractIssues`, a private helper,** recognises the error by class, or by
  `name === "ContractValidationError"` with an `issues` array. The name check exists
  because a Lab instance's own scenario lab (`scenarioLabDist`) can resolve its own
  copy of the contracts package, and that copy's error is a different class.
- **No new export,** so the file still exports the same two functions.

### Tests

**`src/tests/existing-flow-run.test.ts`:**
- **New:** "the existing and clone lanes judge an expected action by the Flow lane's
  own rule".
  - **Five expectations,** each run through `executeExistingPersistedFlow` and through
    `assertFlowActions` on the same attempt. The category, message and details must
    be deep-equal, or neither may throw.
  - **The five:** type with no outcome, type succeeded, click with no outcome, click
    succeeded, and type failed.
  - **It also pins H4's wording** for a missing entry with no outcome:
    `The Flow did not produce a web.dom.click action; it produced web.dom.type:succeeded`,
    with no `expectedOutcome`.
- **Two existing regexes were updated** to the new wording, at lines 59 and 72 of the
  old file.

**`src/tests/prerequisites.test.ts`,** which is `scenarios.ts`'s test. No new test file
was added, since `src/tests` is at its baseline of 50 files.
- **New:** "a manifest the validator rejects fails as fixture.invalid, naming the defect
  and no page value". It builds a throwaway compiled scenario lab, with a
  `package.json` of `type: module` and a `registry.js`, for three shapes:
  - the registry calls the real `assertWebScenario` on import, reached through
    `import.meta.resolve("@fluxiq-web-extension/test-contracts")`. This is the Lab's
    own path;
  - the registry returns the defective manifest, and the runner's check rejects it;
  - the registry throws a lookalike error: an `Error` named `ContractValidationError`
    with `issues`, as another copy of the package would throw.

  Each must be a `RunnerFailure` classified `fixture.invalid`, with exactly
  `Scenario Lab manifest failed contract validation: $.id: must be a kebab-case identifier`
  and `details` equal to `{ issuePaths: ["$.id"] }`. The page sentinel sits in the
  manifest's typed value and final-state value, and must appear in neither the
  message nor the details. The first two shapes must also carry a real
  `ContractValidationError` as `cause`.
- **New:** "a registry that cannot load keeps its own failure rather than
  fixture.invalid".
  - A registry importing a missing module is not a `RunnerFailure` and classifies as
    `environment.missing`.
  - A registry that throws `Error("registry crashed")` stays that error.

## Answer to question 3: a recording that holds zero actions on the Flow lane

This is read from the code, and was not observed. Take admin-console's
`extract-customer-list`, or `short-book`, run with `--flow` on the isolated target.
Its script is one unpaginated `extract` step and a checkpoint, so it records no
action.
1. **The recording lane passes its own checks.**
   - `assertRecordedEvents` gets `[]` (`run-scenario.ts:299`).
   - `assertCoreRoundTrip` needs Core to have persisted a new recording
     (`run-scenario.ts:593-605`). If Core persisted none, the run fails there as
     `recording.persistence`.
   - The finalized-recording wait accepts an entry count of 0
     (`flow-lane/finalized-recording.ts:102-115`, with no minimum).
2. **The completeness check passes at 0 of 0** (`run-expectations/recording-completeness.ts:52-54`,
   pinned by `run-expectations/tests/recording-completeness.test.ts:54`).
3. **The Flow lane fails at the proposal, as `recording.contract`**, in
   `createRecordingFlowProposal`, with one of two messages:
   - `Core produced no recording Flow proposal for the run's recording`
     (`flow-lane/recording-flow-proposal.ts:37-39`);
   - `Core's recording Flow proposal carried no action candidate, so an approved Flow would execute nothing`
     (`:42-44`).
   Approval, the run, `assertFlowActions` and `assertFlowExtraction` are never reached.

So such a run can never pass on the Flow lane, and it never shows as a product
failure. It shows as a harness category, `recording.contract`. Run without `--flow`,
the recording lane alone can pass it, and that lane judges `extracted`.

I did not determine which of the two messages Core produces. Admin-console is in no
bench corpus: a grep of `packages/test-runner/src/bench` for `admin-console` found
nothing.

## Commands run and observed results

**How it was built and run.**
- All builds went to the private `packages/test-runner/dist-glc`, at `dist`'s depth,
  using `pnpm exec tsc -p tsconfig.json --outDir dist-glc`.
- Exit codes were captured through files, never through a pipe.

**First pass, on the fix:**
- **Build:** exit 0, no output.
- **Targeted tests:**
  `node --test dist-glc/tests/existing-flow-run.test.js dist-glc/tests/prerequisites.test.js`
  exited 0, with `# tests 11`, `# pass 11`, `# fail 0`.
- **Structure audit:** `node scripts/structure-audit.mjs` exited 0 with
  `structure-audit: passed (39 warning(s), 17 baselined).` No finding names an owned
  file.

**Mutation proofs.** The two fixed sources were backed up and hashed first:
- `existing-flow-run.ts` `68aa372b…279598`;
- `scenarios.ts` `84bf353b…c606`.

Each mutation was built and tested, then its file was restored with `cp`, and `cmp`
exited 0.
- **M1, the second copy put back** (`existing-flow-run.ts`). The inline loop returned,
  with `expected.outcome ?? "succeeded"` and the old message.
  - Test 3 failed on `expectation [{"action":"web.dom.click"}]`: expected message
    `'The Flow did not produce a web.dom.click action; it produced web.dom.type:succeeded'`,
    actual
    `'Persisted FluxIQ Flow did not produce expected web.dom.click action outcome succeeded; it produced web.dom.type:succeeded'`,
    `deepStrictEqual`.
  - Tests 2 and 4 also failed, because they pin the new wording.
- **M2, the conversion removed** (`scenarios.ts`, where `contractIssues` always
  returned `undefined`). Built together with M1, since the two touch different files
  and different tests.
  - Test 10 failed with
    `expected a RunnerFailure, got ContractValidationError: WebScenario validation failed: - $.id: must be a kebab-case identifier`.
  - The round's totals were `# pass 7`, `# fail 4`: tests 2, 3, 4 and 10.
- **M3, no recognition by name** (`scenarios.ts`, where the check became
  `!(error instanceof ContractValidationError)`).
  - Only test 10 failed, on the lookalike:
    `expected a RunnerFailure, got ContractValidationError: WebScenario validation failed`.
    The totals were `# pass 10`, `# fail 1`.
- **M4, every registry failure converted** (`scenarios.ts`, where a non-contract error
  became `fixture.invalid`).
  - Only test 11 failed, `Expected values to be strictly equal: true !== false`: the
    unbuilt registry had become a `RunnerFailure`. The totals were `# pass 10`,
    `# fail 1`.

**Final pass, on the restored sources, run one after another:**
- **Build:** exit 0, no output.
- **Full suite:** `node --test "dist-glc/**/*.test.js"` exited 0, with `# tests 550`,
  `# pass 550`, `# fail 0`, `# cancelled 0`, `duration_ms 12073.0923`.
- **Check:** `pnpm --filter @fluxiq-web-extension/test-runner check`, from the
  repository root, exited 0. A grep of its output found no `error` or `TS` code.
- **Structure audit, rerun:** exit 0, `structure-audit: passed (39 warning(s), 17 baselined).`

**Things the supervisor warned about, and the rest:**
- **Stale scenario-lab `dist`.** The coordinator's warning, 8 failures in week1-corpus
  and demo-llm-exploration-request, did not appear. The full suite passed.
- **Diff:** `git diff --stat` over the four owned files shows 139 insertions and
  25 deletions.
- **Cleanup:** `dist-glc` and both backups were deleted, and `ls` confirmed each is
  gone. `packages/test-runner/dist-gdal/` belongs to another worker and was left
  alone.

Every result above is a single observation, on a machine with faulty RAM. None
needed a rerun.

## Not verified

- **No Lab run.** A Lab run would have to show two things.
  - **An existing or clone target run** whose Flow lacks an expected action must fail
    `action.dispatch` with the Flow lane's wording, `The Flow did not produce a …`.
    The Lab campaign may not run those targets at all.
  - **`lab run`, or `lab bench`, against a scenario-lab build holding a rejected
    manifest** must print, on stderr,
    `{"status":"failed","category":"fixture.invalid","message":"Scenario Lab manifest failed contract validation: …"}`
    (`cli.ts:68`). That path was exercised only through `loadScenarioManifests` in unit
    tests, never through the CLI.
- **The by-name recognition** was exercised with a synthetic lookalike, not with a real
  Lab worktree whose scenario lab resolves a second copy of the contracts package.
- **Question 3** comes from reading the code, not from a recording.
- **Root gates.** Root `pnpm check`, `pnpm test`, `pnpm build` and the content harness
  were not run; the brief did not name them.

## Open questions or contradictions found

1. **On the existing and clone lanes, H4's difference never changed a verdict, and a
   negative variant still cannot pass there.**
   - `existing-flow-run.ts:89` and `:95` fail a session that did not succeed, and
     `:97-98` fail any attempt whose status is not `succeeded`. All three run before
     the expected-action check, so every attempt that check sees has succeeded, and
     "no outcome" and `succeeded` gave the same match.
   - This fix unifies the rule, the message and the details. It does not make W15
     `popup-blocked` or W26 `no-context` pass on those lanes.
   - Those lanes also never judge `expected.failure`: `run-scenario.ts:229` and
     `:255` set `automationFailure = null`.
   - `g-expected-action-guard`'s open question 1 therefore overstated the effect.
   - Letting a negative variant run there would mean changing the checks at lines
     89-98 and judging the failure in `run-scenario.ts`. Both are outside this brief.
2. **A stale doc comment in a file I do not own.** `packages/test-contracts/src/scenario.ts:94-96`
   still says "The existing and clone lanes still read a missing outcome as
   `succeeded` (`existing-flow-run.ts`)". Every lane now judges presence alone, and
   the sentence should say so.
3. **The `fixture.invalid` failure comes before any run bundle exists.**
   - `run-scenario.ts:51` loads the manifest before the run bundle and its `try`, so
     the category appears only on the CLI's stderr line. There is no `events.ndjson`
     and no `run.json`.
   - The bench loads every manifest once, before any row runs (`cli.ts:51`), so one
     defective manifest fails the whole bench, not one row.
   - This was already true for `Unknown scenario`, and it may be intended.
4. **A Flow-lane run of a workflow that records no action fails late,** as
   `recording.contract` (question 3), after a whole recording lane.
   - The runner could refuse `--flow` for such a workflow up front, as
     `fixture.invalid`, using `recordableActionTypes`.
   - That helper is not exported from the test-contracts barrel. Only `validation.ts`
     uses it.
   - This is a design choice for the supervisor. Nothing in the corpus runs such a
     workflow today.
5. **`flowActionTimings` throws `RangeError` on an attempt whose `startedAt` is not a
   valid time.** The expected-action check now converts through it before judging.
   `run-scenario.ts:228` and `:254` already call it on the same attempts right after,
   so a run is not newly exposed. A malformed attempt now fails inside the check
   rather than one line later.
