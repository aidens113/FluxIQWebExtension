# t267 S5 creation: Lab records A10, created-lane part (3 of 3)

## Outcome

Done. I ported all five of lane A's hunk groups onto dev. Each file was three-way merged
(`git merge-file`, dev against base `45bd6232` against lane A with CRLF stripped). Two conflicts
needed hand resolution, and I made two deliberate changes to lane A's code: no copied advice text,
and `stopped_short` added. `tsc` check passes. Every test in scope passes except failures that come
from the scratch layout and one runner-wiring failure that also happens without my change.

## What changed and why

All paths are under `packages/test-runner/src/` and use LF line endings.

1. **`flow-lane/creation/build-proposal.ts`**: ported and changed.
   - Added `CreatedFlowBuildJudged`, an optional `judged` field on `CreatedFlowBuild`, and
     `createdFlowBuildJudged` (a raw `automationStudioCall("get-flow-adaptation")` read of
     `adaptation.metadata.phase9.auditEvents[eventType=created].detail.buildJudged`).
   - Added `createdFlowBuildJudgedOf`, which checks the value against Core's shape.
   - `judged: null` is now set on diagnostic-built and failed builds.
   - The `readCreatedFlowBuild` `Pick` gains `automationStudioCall`. Its only caller,
     `chat/build-from-chat.ts`, passes the full control, so it still typechecks.
   - **Matched to current Core:**
     - The shape is `AutomationStudioFlowBootstrapFinishingVerdict` in
       `!FluxIQ/.../flow-bootstrap/unfinished-build/finishing-verdict.ts`.
     - `service.ts:1789` writes it through `automationStudioFlowBootstrapFinishingVerdictDetail`
       onto the `created` audit event's `detail.buildJudged`.
     - `flow-bootstrap/review-projection.ts:126` copies whole audit events (`structuredClone`) to
       `metadata.phase9.auditEvents`. That is the same path `existing-fluxiq-control.ts:489-493`
       reads the evidence loop from.
     - Core's fields: `verdict: "yes"`, `round`, `judgedAt`, `flowSignature: sha256-digest|null`,
       `standingFlowSignature: digest`, `matchesStandingFlow: boolean`, optional `confidence`
       (0..1), and optional `unconfirmed: { advice?, patchNeeded? }`.
     - **`judgedAt` now accepts all three values Core writes: `finished_round`,
       `judging_reserve` and `stopped_short`** (`JUDGED_AT` set; t264 S3 added the third).
       Lane A accepted only the first two.
   - **Changed from lane A: no free text.** Lane A copied the judge's advice (up to 500 chars)
     into `unconfirmed.advice`. The brief says never to copy free text such as advice, so
     `unconfirmed` is now `{ adviceGiven: boolean; patchNeeded: boolean | null } | null`.
     - It is null when the judge gave neither advice nor `patchNeeded`.
     - The advice words stay in Core's audit event.
     - I removed `MAX_UNCONFIRMED_ADVICE_CHARS`.
     - I kept lane A's rule that a signature must be a digest (`^sha256:[0-9a-f]{64}$`), so a raw
       signature is no record.
   - Test (`tests/build-proposal.test.ts`): the call order now includes `get-flow-adaptation`.
     `judged: null` is asserted on the plain and refused records. Lane A's two judged tests were
     rewritten:
     - one asserts `adviceGiven: true` and that the advice string is absent from the JSON;
     - one asserts that all three `judgedAt` values parse, with null `confidence` and
       `unconfirmed` when Core recorded none, and that patch-only advice parses;
     - the not-in-shape cases gain an unknown `judgedAt`.
   - `tests/fake-creation-core.ts`: lane A's `buildJudged` option and `get-flow-adaptation`
     answer, ported unchanged.
2. **`flow-lane/creation/chat/chat-record.ts` and `chat/build-from-chat.ts`**: ported unchanged.
   - `said: string | null` is on `CreatedFlowChatRecord` on every ending: the result turn, or the
     answer when no build started, and `null` only when nothing arrived.
   - `chat/tests/build-from-chat.test.ts` is ported unchanged:
     - its fake answers `get-flow-adaptation` before the domain assertion;
     - the created-ending deepEqual includes `said`;
     - a new test covers six endings.
   - **On "the `judged` field on the chat record":** lane A (w118) puts `judged` on
     `CreatedFlowBuild`, which contains `chat`. It does not put it inside `CreatedFlowChatRecord`.
     t264's note ("w118's downstream chat-record `said` and `judged` fields") describes those same
     fields, so I kept lane A's placement. A chat build's record carries both `build.chat.said` and
     `build.judged`, and the lane test checks them in `flow-lane.json`.
3. **`flow-lane/creation/lane.ts`**: ported (a doc comment on `StartedBuild` only).
   - `tests/lane.test.ts`: `get-flow-adaptation` was added to the call order, and `chatCore` takes
     `FakeCreationCoreOptions`. Lane A's two tests (published `said` and `judged`; `said` on the
     incomplete record) were added.
   - This file had a conflict: dev's t262 test and lane A's tests were appended at the same spot.
     I kept both, dev's first.
4. **`flow-lane/lane-observation.ts`**: ported unchanged.
   - `selectLaneObservation` takes an optional `stoppedLane`. It gives `flowCreated: true` only
     when `flowId` is not null, `build.outcome === "proposed"`, and `review` is not null.
     `CreatedFlowLaneIncomplete` on dev has all three fields.
   - `tests/lane-observation.test.ts`: ported, with one change. Lane A's test used
     `failureCategory: "facility.contract"`. That category exists only in lane A's uncommitted
     test-contracts, and dev's `RunEvaluation` contract rejected it (seen in the first run). I
     changed it to `"runtime.behavior"`.
5. **`run-scenario.ts`**: merged.
   - Added `let stoppedLane` and passed `stoppedLane` to `selectLaneObservation`.
   - Ported `prepareFlowPage("playback")` unchanged. It closes every tab whose URL is a scenario
     URL or the blank tab, except `page` and `extensionControl`. Extension pages are never
     matched.
   - **Conflict:** dev's `recordIncompleteEvidence` is now an async block that writes the creation
     identity and reads `getExactFlow` before writing `flow-lane.json`. I kept dev's block and put
     `stoppedLane = incomplete;` as its first statement, so a hash read that throws still leaves
     the record for the observation.
   - The file grew from 790 to 794 lines, close to the 800 limit.

## Commands run and observed results

- Bundling with the brief's `t267-s1/run-subset.mjs` **failed** on esbuild "Could not resolve
  chromium-bidi/..." because it bundles `@playwright/test`.
  - I used a copy, `scratchpad/t267-s5-cre/run-subset-ext.mjs`, which is identical except that
    `@playwright/test` is external. It also takes an optional `T267S5_OUTDIR`.
- Files: 13 `flow-lane/creation/tests/*.test.ts`, `chat/tests/build-from-chat.test.ts` and
  `flow-lane/tests/lane-observation.test.ts`. Also importers of changed symbols:
  - `bench/tests/run-bench.test.ts`
  - `live-llm/tests/{build-usage,call-rows,live-llm-run}.test.ts`
  - `run-evaluation/tests/runner-wiring.test.ts`
  - `tests/scenario-assertions.test.ts`
- Run 1 (`node --test` on all the bundles): 205 tests, 193 pass, 12 fail.
  - 8 in judgement.test and 2 runner-wiring/scenario-assertions load failures came from the
    layout and externals described below.
  - 1 was mine: the `facility.contract` category, now fixed.
  - 1 was `live-llm-run.test` "re-authored reports every call" (`ending`/`try` fields). That
    file belongs to another worker, and the test passed in run 2.
- Run 2, after the fix: 229 tests, **207 pass, 22 fail, all 22 in `runner-wiring.test`**.
  - Cause: the bundle sits one directory deeper than `src/` (`.test-build-scratch/<label>/`), so
    `new URL("../../...")` resolves the repository root to `packages/`. The error was "ENOENT
    ...packages/packages/test-runner/src/run-scenario.ts".
  - judgement.test failed the same way in run 1 ("Scenario Lab build is missing:
    ...packages/apps/scenario-lab/dist/registry.js").
  - All new and ported tests passed, including `flowCreated true`, the three judged tests, the
    six-ending `said` test, and both lane `said`/`judged` tests.
- Run 3: judgement.test and runner-wiring.test bundled at `src/` depth
  (`packages/test-runner/.t267-s5-cre`): 29 tests, **28 pass, 1 fail**.
  - The failure: runner-wiring "a Flow-lane run of a workflow whose script records no action is
    refused as fixture.invalid" gives `environment.missing` (generic message "Scenario attempt
    failed outside a finalized bundle").
  - **Not caused by my change.** I bundled the same test with dev HEAD's `run-scenario.ts` (my own
    file, swapped in for the bundle and restored straight away, checked with `cmp`) and it gave
    the same `environment.missing`. The likely cause is the in-process `runScenario` resolving lab
    paths from the bundle's location.
- `pnpm.cmd --filter @fluxiq-web-extension/test-runner check`: domain build reused, then
  `test-runner:check` (`tsc --noEmit`) built in 16.4 s with no errors.
- `node scripts/structure-audit.mjs`, run after deleting my scratch builds: exit 1, 12 violations,
  none in my files.
  - 11 are file-lines on another worker's `.test-build-scratch/t267-s5-rec/` bundles.
  - 1 is `src/live-llm/live-llm-run.ts` at 802 lines, another worker's file.
  - My files have advisory warnings only: `build-proposal.ts` 674, `lane.ts` 643,
    `lane.test.ts` 722, `build-proposal.test.ts` 538 and `run-scenario.ts` 794 lines;
    `creation/` and `creation/tests/` each have 18 files.
- Cleanup: deleted `packages/test-runner/.test-build-scratch/t267-s5-cre`,
  `packages/test-runner/.t267-s5-cre` and `.t267-s5-cre-base`.

## Not verified

- No live run.
- Tab closing at playback is checked only by typecheck; no browser exercised it.
- I did not run the package's full `pnpm test` (tsc dist).
- The runner-wiring source-text tests passed only in run 3's `src/`-depth layout. The one failure
  there also happens on dev HEAD.

## Open questions or contradictions found

- **Advice text.** Lane A's docs diff (`testing-facility.md`) says `unconfirmed` holds "advice and
  `patchNeeded`" and lists `judgedAt` as two values. Following the brief, the record holds
  `adviceGiven` and `patchNeeded`, and accepts three `judgedAt` values. Whoever ports the docs
  needs to match this.
- **Failure category.** Lane A's `facility.contract` failure category (from its
  `existing-fluxiq-control.ts` `contractRefusal` and test-contracts) is not on dev. The lane test
  now uses `runtime.behavior`.
- **Subset runner.** `t267-s1/run-subset.mjs` cannot bundle tests that import `@playwright/test`,
  and its output depth breaks tests that resolve the repository root from `import.meta.url`
  (judgement, runner-wiring). Other workers using it will see the same false failures.
- **Pre-existing failure.** The runner-wiring `fixture.invalid` failure needs a check in the
  package's own tsc dist run, to tell a layout artifact from a dev regression.
