# L1 d7: trial toggle location

## Outcome

Done. A trial step's control evidence now carries its page's location, the same way a read carries `location` beside `scope`. A trial act's toggle `settle` now names its page. Core's own look can go to that page when the witness is stale. All six site-reset cases passed headed in one run.

## What changed and why

**The diagnosis is confirmed.**
- In a single-subflow plan, the judged whole run's acts are recorded in the supervisor's ledger (`service/project-build/whole-trials.ts`).
- `reset-calls.ts` sends reads only to ledgers that already hold an act. So when the trial act is recorded, that ledger has read no page.
- Its tracker therefore had no location for the trial's page token. `settlement-control-tracker.ts` takes locations only from `read(...)`.
- The result: the first refusal after the trial said "Its control still shows …" with no page, and `lookFirst` skipped any stale toggle reason that had no `location`.
- A unit check shows this. With only the ledger's pass-through reverted, both new ledger tests fail; with it in place, they pass.

**Downstream (domain):**
- `domain/src/runtime/state-diff/places/diff.ts`: `controlsAt` now adds `location`, the same `before.evidence.location` the page token is hashed from. A start-state read takes its `location` from that same field (`start-state/page-state.ts`). The header comment is updated.
- `domain/src/runtime/state-diff/places/tests/places.test.ts`: asserts `controls.location`. The words check now runs over the diff without that one field, and its regex is tightened from `ivanhoe"` to `ivanhoe`, so no other part of the diff carries page words.

**Core (`RT/` = `packages/fluxiq/src/programs/automation-studio/runtime/`):**
- `RT/flow-bootstrap/site-reset/contracts.ts`: `AutomationStudioSiteResetTrialActPlace.controls` gains `location?: string`.
- `RT/service/candidate-trial/landed-acts.ts`: `controlsOf` carries `location` when it is a non-empty string of at most 2,048 characters with no control characters (the start-location bound). Otherwise it drops the location and keeps the counts. The header is updated.
- `RT/flow-bootstrap/candidate/trial-acts.ts`: the whole-candidate gate's copy keeps `location` under the same rule.
- `RT/flow-bootstrap/site-reset/settlement-control-tracker.ts`: `landed(page, place, before, after, clock, location?)` records the page's location when given. This is safe because the page token is built from that location.
- `RT/flow-bootstrap/site-reset/ledger.ts`: `trialRan` passes `act.controls.location`.
- The subflow gate passes `answer.acts` through whole, so it needed no change.

**Tests:**
- `RT/service/candidate-trial/tests/landed-acts.test.ts`: a new test checks that the location is carried, and that malformed values are dropped with the counts kept. The malformed values are empty, a newline, NUL, 2,049 characters, a number, null, an array and an object.
- `RT/flow-bootstrap/candidate/tests/trial-gate-reset.test.ts`: the carry test now has a location on step 1, plus steps 3 to 5 with malformed locations. Those keep their controls without a location.
- `RT/flow-bootstrap/site-reset/tests/settlement-shapes.test.ts`, shape G, two new tests:
  1. A trial act's toggle, recorded by a ledger that read no page of it, has a `settle` naming `loc:post`. Then a read of the page, the press back under `undoes` (admitted `own`), and the read after it settle the act `restored`, and the next `beforeTrial` admits.
  2. A stale trial toggle makes `beforeTrial` call `lookAt("loc:post")`. The witness goes stale when a later trial's step presses the same control back and no read reaches the ledger. The look's read settles it and the trial is admitted.

**Browser proof:** `apps/extension/e2e/site-reset/tests/photo-toggle.spec.ts`.
- After `unlike.trial` (step 15) the build tests once more (`trial.final`), and step 16 records the answer.
- New assertions on that answer:
  - it is not `candidate.trial_reset_required` or `candidate.trial_reset_unproved`;
  - it is `yes`;
  - `startedWith` does not list the trial act;
  - its `trialRunId` equals the passing test's. Past the builder's reset gate, the supervisor's `alreadyJudged` (t679) answers this revision's standing yes without running it again.
- The trial act's `settle` must now be exactly `controlSettle(likedPage)`. The old check also accepted the version with no page.
- Every other assertion is unchanged, and the doc comment is updated.

## Commands run and observed results

**Core tests:**
- `npx vitest run` over `RT/flow-bootstrap/site-reset`, `RT/service/candidate-trial`, `RT/flow-bootstrap/candidate` and `RT/service/project-build`: `Test Files 86 passed (86)`, `Tests 707 passed (707)`, exit 0, 413.7s.
- Negative check: with only the ledger's `act.controls.location` argument removed, `settlement-shapes.test.ts` gave `2 failed | 19 passed`, the two new d7 tests. With it restored, 21 passed.

**Domain tests:**
- `DOMAIN_TEST_BUILD_LABEL=l1d7 node scripts/test-domain.mjs src/runtime/state-diff src/runtime/llm-evidence/control-spot/tests`, run from `domain/`: `# tests 41`, `# pass 41`, `# fail 0`. This includes "ok 33 - a step pressing a toggle carries its place and state…".
- The brief's command assumes the repository root, but the script lives at `domain/scripts/test-domain.mjs`.

**Type checks, all exit 0:**
- `npx tsc -p packages/fluxiq/tsconfig.json --noEmit` (Core)
- `npx tsc -p domain/tsconfig.json --noEmit`
- `npx tsc -p domain/tsconfig.test.json --noEmit`
- `npx tsc -p apps/extension/tsconfig.test.json --noEmit` (re-run after each spec edit)

**Structure audits:** `node scripts/structure-audit.mjs` passed in both repositories.
- Core: "passed (409 warning(s), 1152 baselined)".
- Downstream: "passed (212 warning(s), 638 baselined)".

**Builds:**
- `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` (Core): exit 0. `fluxiq` rebuilt in 671s; contracts and the websocket client were reused from the build cache.
- `pnpm test:e2e:build` (in `apps/extension`): exit 0, with chrome, firefox and e2e-chromium each "verified 22 files".

**Headed site-reset run:** `node --no-experimental-strip-types node_modules/@playwright/test/cli.js test -c e2e/playwright.config.ts e2e/site-reset/tests/ --workers=2 --reporter=list`, from `apps/extension`, with 2 workers and no memory trouble.

- **Run 1 (5 passed, 1 failed, 9.2m):** photo failed on an extra assertion I had added: three succeeded steps in the final test's feedback. That answer carries no `steps`.
- **Run 2 (5 passed, 1 failed, 8.2m):** photo failed on my next extra assertion, that the `trialRunId` differs. It equals the passing test's, which is how I found the `alreadyJudged` path.
- **Run 3, final (`6 passed (6.9m)`, exit 0):**

  | Case | Duration |
  | --- | --- |
  | installed-project new-row inverse | 1.9m |
  | installed-project failed save / retry | 2.2m |
  | job-failed-save | 59.3s |
  | office buy-now create | 55.9s |
  | office trial repeat | 1.4m |
  | photo-toggle | 1.6m |

  - Photo diagnostic: `{"ending":"proposed","tests":["candidate.trial_reset_required","yes","candidate.trial_reset_required","yes"],"other":"candidate.undo_unproved","unlike":true,"trialAct":"act-4","trialUnlike":true}`.
  - The trial act-4's settle: "Its control at http://127.0.0.1:61162/scenarios/photo-social/p/D1OKDvAEHfa/ still shows the state this act set: …". This is the same page as the explored act-2's.

## Not verified

- Firefox, live providers and paid runs: none were run. Everything was provider-free with the scripted provider.
- A multi-subflow plan's trial act. Its ledger already gets reads, but the location now rides there too. Only unit tests and the gate carry test cover it.
- The final photo test proves that the builder's reset gate admitted the test: a refusal returns before the port is asked, and the answer is a verdict. It does not prove a fresh trial ran, because Core answered with the standing judged run (t679).
- Full suites were not run, per the twice-a-day rule.

## Open questions or contradictions found

1. The brief said to "assert the test is admitted … on the restored post". Past the builder's gate, the supervisor's `alreadyJudged` (`project-agents/supervisor/whole-trial.ts`) returns the revision's standing yes without running it again and without consulting the supervisor's whole gate reset. The spec asserts that path explicitly, so it will flag a change if t679 changes.
2. The brief's domain test command needs `domain/` as its working directory.
3. The worktrees already held uncommitted work from earlier workers (L1 c/d units). I touched only the files listed above.
