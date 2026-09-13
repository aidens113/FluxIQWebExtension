# d-testing-facility-page — `testing-facility.md` brought to its finished Week 1 state

Worker report for the thirty-fifth dispatch. The repository was at `af80298`, with
other workers' uncommitted changes in the tree.

## Outcome

Done. Every `testing-facility.md` item in `reports/i-arch-pages-audit.md` (T1 to T10)
is fixed, and so is the stale comment at `packages/test-runner/src/run-scenario.ts:270-277`.
The page gains:
- a section on the recording lane and the Flow lane, with the lane rules, the
  recording checks and the run leak check;
- declared secrets and declared uploads;
- a section on the bench;
- a subsection on the content-script harness.

The link check and the structure audit both pass.

## What changed and why

### `docs/architecture/testing-facility.md`

- **T1 and T10, the auth-gate password:**
  - the "states in plain sight" and "printed on its own page" claims are gone;
  - the row now says the sign-in page shows a placeholder where the password would be
    (`auth-gate/pages.ts:33`, `constants.ts:8-13`);
  - the variable's row names W18, and W19's `expired` variant, whose Flow also signs in;
  - the page no longer claims the value is "kept out of the manifest". The recording
    script's `enter-password` step carries it, as a reference to
    `authGateDemoCredentials.password` (`manifest.ts:45`), and the run leak check scans
    for exactly that value (`scenario-redaction-literals.ts`). The page now says so;
  - no value is quoted.
- **T2, "an omitted outcome means `succeeded`":**
  - restated: an entry with no `outcome` is judged on the attempt's presence alone
    (`flow-lane/expectations.ts:6-18`), and the existing and clone lanes use the same
    function (`existing-flow-run.ts:14,110`);
  - added the recordable-action check (`test-contracts/src/validation.ts:180-203`,
    `recordable-actions.ts`), including a paginated extract's Next clicks;
  - added that a contract rejection is `fixture.invalid`, whether it comes from the
    registry import or from the runner's own validation (`scenarios.ts:7-46`), and that
    it has no bundle, because the manifest loads before the bundle is created
    (`run-scenario.ts:51` against `:82`).
- **T3, the Flow lane and the bench:**
  - the "isolated mode does not synthesize or persist a FluxIQ Flow" paragraph now
    introduces the two lanes;
  - the "those two verified lanes do not prove persisted Flow execution" sentence is
    rewritten.
  - **New section "Recording lane and Flow lane", with these subsections:**
    - **the recording lane:** start wait, `recording-start.json`, pagination;
    - **the Flow lane:** its eight steps; the judging order of failure, actions,
      extraction, then the oracle; `flow-lane.json`; `evaluation.json` and the one
      evidence-size reader;
    - **Declared replay secrets:** moved here, heading text kept (see T8);
    - **Declared uploads:** `declared-uploads.ts:44-93`;
    - **Lane rules:** `lane-rules/*.ts`, with the probe's one-second bound from
      `PROBE_TARGET_VISIBLE_MS`;
    - **Recording checks:** persistence, completeness, and the two-read discard audit
      with its window (`recording-discards.ts`, `run-scenario.ts:412-434` before my edit);
    - **The run leak check:** literals, scopes, `writtenSince`, text, SQLite in three
      encodings and cell by cell, `unscanned-store`, limits, `security.redaction`,
      `redactionState`, the `node:sqlite` child process, and the known freed-page limit.
  - **New section "The bench":** the smoke and week1 corpora (29 rows, 67 results per
    repeat, which I counted from `week1.ts`), skips, output files, per-lane rates and
    `notExecutedRuns`, and failure causes.
  - Added `pnpm lab run basic-form --flow` to the command block, and the `compare`
    tolerances (`bench-report.ts:24-25,136-144`).
- **T4, the leak checks that "skip databases":**
  - the `demo:llm:setup` sentence and the closing provider-secret attestation sentence
    now say SQLite stores and their `-wal`, `-shm` and `-journal` files are read, and
    only other known binaries are skipped (`demo-llm-attestation.ts:6-25`,
    `secret-leak-attestation.ts:35-54,134-150`).
- **T5, the 10 s window and "latches idle":**
  - trimmed to the reselect and its reason, as the supervisor decided;
  - the clone lane selects its project once, at import;
  - links to `extension-client.md#recording-evidence` for how a refused start is handled.
- **T6, the fixture count:**
  - corrected from 22 to 25;
  - added a table for `storefront-checkout`, `admin-console` and `member-directory`,
    with their workflows and variants read from each `manifest.ts`, none of them in
    `week1.ts`;
  - the page-spec paragraph now mentions their specs and `negative-variants.spec.ts`.
- **T7, the content harness:**
  - new subsection "Content-script harness" (config, global setup, stubbed
    `chrome.runtime`, 25 specs, what it does and does not prove, command);
  - the finite suite paragraph now says those specs share only Scenario Lab's network
    guard (`e2e/fixtures/network-policy.ts:1`);
  - the cross-frame sentence now says neither Playwright suite proves delivery to a child
    frame through the background worker. The harness proves only the receiving half
    (`frames.spec.ts:1-12`), and the sending half is unit-tested in
    `apps/extension/src/runtime/tests/`.
- **T8, declared secrets:**
  - added the `web.secret.<key>` path;
  - resolution before the bundle, and the `fixture.invalid` failure for a step no script
    contains;
  - one-to-one pairing by control, failing before the Flow starts
    (`declared-secrets.ts:102-152`);
  - one supply per path; Core's withholding at rest, linked to `sensitive-values.md`;
  - `storefront-checkout`'s five declared variables, named by id and never by value
    (`manifest.ts:140-172`).
- **T9, step operations:** the manifest bullet now says `extract` with `pagination`
  clicks `next`, up to 50 pages, and those clicks are recorded (`scenario.ts:5-6,21-49`).
- **Kept out, as the dispatch decided:**
  - Core's dispatch deadline and timeout forwarding;
  - W15 and W28;
  - how W05 `short-catalog` is judged;
  - `late-target-wait.ts:15`;
  - plan history.

### `packages/test-runner/src/run-scenario.ts`

- The 8-line comment at `:270-277` is replaced with 2 lines, now `:270-271`. It drops the
  10 s `freshnessMs` and "stays idle for good" claims.
- The code is unchanged. `git diff` shows only that hunk.

## Commands run and observed results

All were run from `F:\!FluxIQWebExtension`.

- **The link check:**
  `node C:/Users/mrjoh/AppData/Local/Temp/claude/f---FluxIQWebExtension/4f264c80-323b-4673-a09a-bde5851669f3/scratchpad/dcd-check-links.mjs docs/architecture/testing-facility.md`
  exited 0 and printed `checked 17 relative links in 1 page(s), 0 unresolved`.
- **The structure audit:** `node scripts/structure-audit.mjs` exited 0 and printed
  `structure-audit: passed (41 warning(s), 17 baselined).`
  - Among its advisory warnings: `packages/test-runner/src/run-scenario.ts: 694 lines is
    past the 400-line advisory threshold.`
  - The file was longer before the edit, and it has no baseline entry.
- **A search for stale phrases:** `grep` over the page for `22 deterministic`,
  `22-fixture`, `ten seconds`, `10_000`, `latches idle`, `plain sight`, `printed on`,
  `does not synthesize`, `excluding intentional database`, `explicit binary formats`,
  `omitted outcome`, `corpus row W19` and `kept out of the manifest` found no match. The
  same search over `run-scenario.ts` for `freshnessMs`, `stays idle`, `10 s old` and
  `750 ms local` found none either.
- **The password is in neither file:** a shell count of the auth-gate fixture password,
  with the value read into a variable and never printed, returned `0` for both files.
- **`git diff --stat` on the two files:** `testing-facility.md | 578`,
  `run-scenario.ts | 10`, `502 insertions(+), 86 deletions(-)`.
- **No test, build or Lab command ran.** None was named for this docs brief, and the
  binding rules forbid `pnpm build` and `pnpm lab`.

## Not verified

- **Rendering in a Markdown viewer.** The link checker resolves files and heading slugs
  only.
- **The content-harness command I documented.**
  - I did not run
    `pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=2 <spec>`,
    nor the `test:content` script.
  - The statement that the harness needs `packages/test-contracts` built comes from that
    package's `exports` (`import: ./dist/index.js`), and from `test:content` building it
    first.
- **Claims resting on Core or the ledger, not on code I read:**
  - that Core keeps a run's input keys and withholds their values at rest (Core 0.4.0,
    `6621d66`), which is cited from the audit and Current State;
  - the known freed-page limit of the leak check, from the audit (ledger part 36). The
    code comments are consistent with it.
- **What `frame-address.test.ts` and `action-runner.test.ts` assert.** The "sending half
  is unit-tested" wording follows the header of `frames.spec.ts`.
- **That `report.md` lists failure causes at its top.** This is from the docstring in
  `bench/failure-cause.ts`; I did not read `render-markdown.ts`.
- **Whether `lab run` prints the evaluation.** No match for `evaluation` in `cli.ts`, so
  the page says only that `evaluation.json` is written.
- **Live behaviour:** no Lab run confirms any of the described lane behaviour.

## Open questions or contradictions found

1. **An uncommitted change in the tree adds a Flow-lane check my page does not
   describe.**
   - `run-flow-lane.ts` and `persisted-flow-run.ts` (not mine, W28's shape from
     `i-w15-w28-flow-order`) add `assertFlowDidNotStopEarly`. It fails a run that Core
     failed with every attempt succeeded and some action never attempted, as
     `action.dispatch`, and runs before `expected.failure` is judged.
   - The dispatch held W28 back, so the page's "judged in this order" list in "The Flow
     lane" omits it. Once that change is committed, the list, and `flow-lane.json`'s
     field list if the stop is published, need one more bullet.
2. **The auth-gate manifest does carry the password.** It is the recording script's
   `enter-password` value, a constant reference. The old page's "kept out of the
   manifest" was false. The page now says the Flow lane takes the value only from the
   variable, and that the leak check scans for the manifest's value.
3. **`harnessActivations` is published but, as far as I found, not asserted to be 0 on
   the Flow lane.** The comment says it "must stay 0". The page describes it as published
   only.
4. **Two of the audit's not-verified items are now settled.**
   - The probe's one-second bound is `PROBE_TARGET_VISIBLE_MS = 1_000` in
     `run-scenario.ts`.
   - "`scenario-pages.spec.ts` covers eleven of the twelve" holds: that spec has 11
     `test(` entries, none for `instruction-only-form`.
5. **The declared-secrets section moved** under "Recording lane and Flow lane". Its
   heading text is unchanged, so `sensitive-values.md:214`'s link to
   `testing-facility.md#declared-replay-secrets` still resolves.
6. **Disclosure.** While reading, a `grep` over `apps/scenario-lab/src/scenarios/auth-gate`
   printed the fixture password constant into my tool output. It was never written to
   any file, the page or this report.
