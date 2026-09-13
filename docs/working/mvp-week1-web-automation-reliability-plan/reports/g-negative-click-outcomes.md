# g-negative-click-outcomes — three negative variants whose click must fail

Worker report, 2026-09-13, at `HEAD c29018f`.

## Outcome

Done. Auth-gate `expired` (W19), navigation `broken-link` (W10) and
failure-surfaces `blocked-url` (W27) now declare their click's expected outcome
`failed`, as `disabled` and `detached` already did. Each scenario's unit test
pins that variant's actions, and each pin has a mutation proof. Scenario-lab
`check` and `test` pass.

Re-verified at HEAD before editing. This was not already settled: all three
variants expected the click to succeed, and `apps/scenario-lab` had no
uncommitted changes.

## What changed and why

Why: `assertFlowActions` (`packages/test-runner/src/flow-lane/expectations.ts:9`)
treats a missing outcome as `"succeeded"`. A variant's `expected` fields replace
the workflow's rather than merging (`packages/test-contracts/src/scenario-workflow.ts:91`).
So once C1 or E4 fails these clicks, the Flow lane would throw at
`run-flow-lane.ts:130` even when the failure category is right. That is the
contradiction described in `reports/i-w19-expectation.md` "Follow-up: W10 and W27".

- `apps/scenario-lab/src/scenarios/auth-gate/manifest.ts`: the `expired`
  variant declares
  `actions: [{ web.dom.type, succeeded }, { web.dom.click, failed }]`. It
  inherited no `actions` before. Because the list replaces the workflow's, the
  typing, which still succeeds, is restated. A three-line comment says so. The
  primary (W18) is unchanged.
- **Navigation manifest.** The navigation scenario has no `manifest.ts`: its
  manifest is inline in `apps/scenario-lab/src/scenarios/navigation/scenario.ts`,
  in `defineScenario({ manifest: createScenarioManifest(...) })`. In the
  `broken-link` variant, `{ action: "web.dom.click" }` became
  `{ action: "web.dom.click", outcome: "failed" }`, with a one-line comment.
- `apps/scenario-lab/src/scenarios/failure-surfaces/manifest.ts`: the same
  change for `blocked-url`, with a one-line comment.
- `apps/scenario-lab/src/scenarios/auth-gate/tests/scenario.test.ts`: the test
  "manifest is valid and resolves W18 (primary) and W19 (expired)" asserted that
  `actions` is inherited from the primary, which is no longer true. It now:
  - drops `actions` from the list of inherited fields;
  - pins the primary's actions (type succeeded, click succeeded);
  - pins `expired`'s actions (type succeeded, click failed).
- `apps/scenario-lab/src/scenarios/navigation/tests/scenario.test.ts`: the first
  test pins the primary's actions (`web.browser.navigate` succeeded) and
  `broken-link`'s (`web.dom.click` failed).
- `apps/scenario-lab/src/scenarios/failure-surfaces/tests/scenario.test.ts`: the
  per-variant loop in the first test pins
  `[{ web.dom.click, failed }]` for `disabled`, `detached` and `blocked-url`.
  Each assertion is labelled with its variant id.

Nothing else changed: 6 files, 18 insertions and 3 deletions. **Scenario Lab e2e:**
no spec pins these variants' click outcome, so no spec was changed or run.
- Evidence: a search for `.actions` and `web.dom.click` across
  `apps/scenario-lab` outside `src/scenarios` found no matches.
- `e2e/negative-variants.spec.ts` checks only each armed page's final state and
  its console errors. Its header says so: "What is *not* pinned here is the
  failure code a run reports."

## Commands run and observed results

Every run below had `EXTENSION_TEST_BUILD_LABEL=g-negative-click-outcomes` set,
and each exit code was captured by redirecting the output to a file.

1. `pnpm --filter @fluxiq-web-extension/scenario-lab check` printed `EXIT=0`
   (`tsc -p tsconfig.json --noEmit`, no diagnostics).
2. `pnpm --filter @fluxiq-web-extension/scenario-lab test` printed `EXIT=0`,
   `# tests 202`, `# pass 202`, `# fail 0`. The changed tests passed:
   - `ok 28 - manifest is valid and resolves W18 (primary) and W19 (expired)`
   - `ok 52 - the manifest is valid and resolves one variant per surface, each with its own code`
   - `ok 152 - the manifest is valid and resolves its primary workflow and broken-link variant`
3. **Mutation proof.** The three source files were hashed first (SHA-256):
   - auth-gate/manifest.ts `006A6B43…4E1E60`
   - navigation/scenario.ts `8E8C25D3…835DED`
   - failure-surfaces/manifest.ts `54E87EC6…FB7357`

   Then, in each of the three variants, the click outcome was flipped from
   `"failed"` to `"succeeded"`. In failure-surfaces only the `blocked-url` entry
   was flipped. The mutated build was `node scripts/build-scenario-lab.mjs`,
   which printed `BUILD_EXIT=0`. Each test file was then run with
   `node --test dist/scenarios/<name>/tests/scenario.test.js`:
   - **auth-gate** printed `EXIT=1`, `# pass 11`, `# fail 1`:
     `not ok 1 - manifest is valid and resolves W18 (primary) and W19 (expired)`,
     with the diff `+ outcome: 'succeeded'` / `- outcome: 'failed'`.
   - **navigation** printed `EXIT=1`, `# pass 4`, `# fail 1`:
     `not ok 1 - the manifest is valid and resolves its primary workflow and broken-link variant`,
     with the same diff.
   - **failure-surfaces** printed `EXIT=1`, `# pass 12`, `# fail 1`:
     `not ok 1 - the manifest is valid and resolves one variant per surface, each with its own code`.
     The error message was `blocked-url`, followed by the diff
     `+ outcome: 'succeeded'` / `- outcome: 'failed'`.

   After restoring, the three hashes are identical to the pre-mutation hashes,
   so all three files are byte-identical. A rebuild and rerun of
   `pnpm --filter @fluxiq-web-extension/scenario-lab test` printed `EXIT=0`,
   `# tests 202`, `# pass 202`, `# fail 0`.
4. `node scripts/structure-audit.mjs` printed `EXIT=1`, from one violation that
   is not mine:
   `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks`.
   - A rerun once gave the same single violation.
   - None of my six files was flagged.
   - The rest of the output was advisory warnings in other areas, including
     `apps/scenario-lab/e2e/: 18 source files is past the 15-file advisory threshold`.
     I did not touch that directory.
   - Clearing the violation needs `pnpm structure:baseline`, which workers may
     not run.
5. `git diff --stat -- apps/scenario-lab` listed exactly the six files above.

## Not verified

- **No Lab run** (forbidden in this dispatch). A Lab run with C1, E1-E4 and D1
  landed must show all of the following:
  - W19 `expired`: the Flow lane reports `auth_required`, with the
    `web.dom.type` attempt `succeeded` and the `web.dom.click` attempt `failed`.
  - W10 `broken-link` and W27 `blocked-url`: the Flow lane reports
    `navigation_unexpected` / `web.navigation.unexpected`, with the
    `web.dom.click` attempt `failed`.
  - None of the three throws "The Flow did not produce a web.dom.click action
    with outcome …" at `run-flow-lane.ts:130`.
- **Before those producers land,** these rows still fail. They now fail in
  `assertFlowFailure` (`:129`, no structured failure reported) before the
  actions check runs, exactly as they did before this change, so an interim
  Lab run is no worse. If C1 lands before E4, W10 and W27 keep failing until E4
  lands.
- **The existing and clone lanes.** `packages/test-runner/src/existing-flow-run.ts:96-97`
  throws on any attempt whose status is not `succeeded`, before it reads the
  expected actions (`:106-108`). Those lanes therefore can never match an
  expected `failed` action. This was already true of `disabled` and `detached`.
  I did not trace whether those lanes run negative variants at all.
- **Bench scoring.** I did not trace how the bench scores a negative variant
  whose category matches but whose actions check throws (`evaluate-run.ts`).
- **Full gates.** `pnpm check` and `pnpm test` at the repository root were not
  run; the brief names only scenario-lab's `check` and `test`.

## Open questions or contradictions found

1. **The structure audit fails on `docs/working/README.md`,** which is out of
   date with the working documents' header blocks. That is a shared file this
   worker does not own, most likely left stale by this session's working-doc
   edits. The supervisor needs to regenerate it (`pnpm structure:baseline`)
   before `pnpm check` can pass.
2. **The existing and clone lanes cannot honour an expected `failed` action**
   (`existing-flow-run.ts:96-97`). If those lanes run W19, W10 or W27, they will
   reject the run on the failed click whatever the manifest declares. This is a
   `packages/test-runner` question outside this brief.
