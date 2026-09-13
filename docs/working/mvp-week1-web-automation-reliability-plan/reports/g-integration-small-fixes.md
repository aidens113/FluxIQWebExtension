# g-integration-small-fixes — the queued comment, cast and script corrections

Worker report. Brief: `briefs/finish-week1.md` "g-integration-small-fixes", plus
the supervisor's mid-task amendment adding `observed-run-evaluation.ts:32-36`.
Tree at `HEAD 1f98375`, with other workers' edits in flight (test-runner files
of `g-single-run-evidence`, the plan document, Core). No `pnpm build`, no
`pnpm lab`, no commit. Every result below is a single observation on a machine
with faulty RAM; no run needed a retry.

## Outcome

**Done**, with two casts deliberately kept, because the compiler still needs
them. Every item was re-checked at HEAD first and was still stale there. The
exception was the `test:content` item, whose literal wording already held (see
below). All the named gates pass except the structure audit, which fails only
on two working documents that another agent owns.

- 13 of the brief's items are corrected. There are 14 changed files, listed below.
- **Casts.**
  - `domain.test.ts`: the cast is removed.
  - `project.test.ts:47` and `forms.test.ts:151`: kept. Removing each one fails
    to compile, and the file is restored byte-identical (`git diff` empty).
- **`test:content`.**
  - **At HEAD:** `-- <spec>` already ran the spec (4 passed). What broke was any
    flag after the `--`, which Playwright read as a file filter, so `-- --list`
    exited 1 with "No tests found".
  - **Now:** the script strips the forwarded `--`, so the `--` form behaves
    exactly like the bare `pnpm exec playwright test` command.

## What changed and why

### `docs/architecture/failure-taxonomy.md`

- **Worker-side verbs bullet (`:133-140`).**
  - It now names `runtime/click-landing.ts`, which gives `NAVIGATION_UNEXPECTED`
    for a replayed click whose own tab lands on a page served 400 or above
    (`reports/w19-e4.md`).
  - It says `runtime/action-results.ts` builds the record that every worker-side
    navigation check uses. That is verified: `navigationUnexpectedFailure` is
    called from `action-runner.ts:149`, `browser-tab.ts:126` and
    `click-landing.ts:205`.
- **The paragraph that miscounted producers (`:146-159`).** It said
  `USER_INTERVENTION_REQUIRED` had one producer and `PAGE_CHANGED` none. At
  HEAD, grep shows:
  - **`USER_INTERVENTION_REQUIRED` has three producers:**
    - `content/action-runtime/results.ts:192`, `blockedByModal`;
    - `domain/src/client/gateway-mapping.ts:351`, `unsuppliedValueFailure`;
    - `domain/src/runtime/adapter.ts:121`.
  - **`PAGE_CHANGED` has one:** `content/actions/page-identity.ts:96`.

  The paragraph now names each producer and when it fires, and the tests that
  cover them: `modal-intervention.spec.ts`, `gateway-mapping.test.ts` and
  `page-identity.test.ts`. The old claim "covered only by the code table's own
  tests" is gone.

### `docs/architecture/web-capabilities.md`, the Click row only

- `runtime/click-landing.ts` is added to Owning files.
- One sentence is added, taken from the module header (`click-landing.ts:1-36`):
  - a click that takes its own tab to a page served 400 or above fails with
    `navigation_unexpected`, naming the status and the path without its query;
  - a soft 404 served 200 is not caught;
  - Firefox, which keeps no response status, is not judged.

### `domain/src/recording/tests/domain.test.ts`, the cast

- **Cast and comment removed.** The cast
  `as unknown as Parameters<typeof createWebAutomationStateFromSnapshot>[0]` is
  gone, and so is its four-line comment. That comment claimed
  `WebAutomationDomSnapshotInput` declares no `evidence`, which is false now
  (`web-state/types.ts:71-79`).
- **Why the fixture is now typed.** Without the cast, the untyped fixture's
  string literals widen, and `tsc` reported
  `domain.test.ts(99,3) … 'loading.documentState' … string is not assignable to
  WebAutomationDocumentReadyState`. So the fixture is now declared
  `const pageEvidence: WebAutomationPageEvidence`, imported as a type from the
  `../../page-evidence` barrel, the same path `web-state/types.ts:8` uses.
- **One test-data value changed, which the cast had hidden.**
  - **The mismatch:** with the type in place, `tsc` reported
    `domain.test.ts(77,5): Type 'false' is not assignable to type 'true'`. The
    fixture carried `dialogs.armPending: false`, but the contract is
    `armPending?: true | undefined` (`page-evidence/types.ts:120`).
  - **The fix:** it is now `true`, as in the sibling fixture
    `web-state/tests/evidence.test.ts:47`.
  - **Coverage is unchanged:** `putFlag` → `flag()` (`evidence/read.ts:47-49`)
    writes a boolean either way, so the same set of state paths is produced, and
    both ratchet rows still pass (`ok 96`, `ok 97`).

### The two casts that stay

- **`domain/src/recording/web-state/evidence/tests/project.test.ts:47`:**
  - **With the cast removed:** `tsc` gives
    `project.test.ts(46,98): TS2322: Type 'Record<string, unknown>[]' is not
    assignable to type 'WebAutomationFormControlEvidence[]' … missing …
    selector, controlType`.
  - **Why it stays:** the file plants wire controls whose flags are absent or
    wrong on purpose, so it needs the cast.
- **`apps/extension/src/content/evidence/tests/forms.test.ts:151`:**
  - **With the cast removed:** `tsc` gives
    `forms.test.ts(150,5): TS2739: … missing the following properties from type
    'WebAutomationPageEvidence': elements, loading, navigation`.
  - **Why it stays:** the fixture carries only `forms`.

Both edits were reverted, and `git diff` on both files prints nothing. Removing
either cast needs a fixture change, not only a cast removal, so I did neither.

### `apps/extension/src/background/connection/recording-evidence.ts` and two tests

The comments named `connection.ts` as the sender. The sender is now
`RecordedEventIntake.processEvent` (`connection/recorded-event-intake.ts:179-182`),
which captures the snapshot, sends `client.recording_event`, then sends the
evidence. Changes:
- **`recording-evidence.ts:47` and `:89`:** the name `connection.ts` becomes
  `RecordedEventIntake`.
- **`connection/tests/recording-evidence.test.ts:6`:** the same rename.
- **`connection/tests/recording-evidence.test.ts:118`:** it said "Exactly what
  `connection.ts` does". It now says "What `RecordedEventIntake` does for one
  executable recorded action, returning the event it would send", because the
  helper skips the send itself.
- **`background/tests/recording-evidence-pipeline.test.ts:1`:** the same rename.

### `apps/extension/package.json`, the `test:content` script only

**Root cause, observed.** pnpm 9.15.0 forwards the `--` literally. The echoed
command at HEAD was
`playwright test -c e2e/playwright.content.config.ts "--" "--list"`. Playwright
then treats every token after `--` as a file filter, and the filters are OR'd:
- **A spec after `--`** still runs.
- **A flag after `--`** is silently ignored.
- **Only flags after `--`** match no file, and the run fails with "No tests
  found". This is the trap in `live-validation-plan.md:69-72`.

**Fix.** The playwright step is now an inline
`node -e "<drop a leading -->; spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '-c', 'e2e/playwright.content.config.ts', ...args])" --`.
- **The trailing `--`:** node consumes it, so the user's own `--`, when present,
  arrives as `argv[1]` and is dropped. Checked with node v22.11.0:
  `node -e … -- -- e2e/x.spec.ts --list` gives `["--","e2e/x.spec.ts","--list"]`,
  and `-- --workers=2 e2e/x.spec.ts` gives `["--workers=2","e2e/x.spec.ts"]`.
- **The Playwright entry point:** `@playwright/test` 1.51.1 exports `./cli`
  (its `package.json`).
- **The exit status** is Playwright's, or 1 if it was killed by a signal.
- **Precedent:** the inline `node -e` pattern already appears in
  `packages/test-runner/package.json` `domain:dist`.
- **Scope:** the test-contracts build step is unchanged, and no other script
  changed.

### `apps/extension/src/content/action-runtime/validation-outcome.ts:17-23`

- **Old claim:** "a contradiction is dropped whole by Core's parser".
- **Core's actual rule** (`F:\!FluxIQ\packages\contracts\src\failure\parse-record.ts:17-23`,
  `:35-42`) drops a record whole only for the inconsistencies it checks:
  - one of six categories marked retryable;
  - `target_not_found` or `target_ambiguous` at any stage other than
    `target_resolution`;
  - bad fields.
- **What Core cannot see:** the web code-to-row binding. So a real code beside
  another row's category passes Core and reports the wrong failure. This matches
  `g-small-fixes` open question 1 and the type probe that report recorded.
- **New wording:** it says exactly this.

### `apps/extension/e2e/content/tests/identity-fixtures.ts`, the header

- **The fix:** "the three identity specs beside this file" becomes "the six
  specs that import this file", and the three later importers are named. The
  six were verified by grepping each spec for `from "./identity-fixtures.js"`:
  - `identity-resolution`, `identity-ambiguity` and `identity-veto`;
  - `identity-signals`, `identity-wire-chain` and `large-page-resolution`.
- **Left unchanged:** "the four helpers", which was outside the spec count (see
  Open questions).

### `domain/src/output-nodes/targets.ts:42-53` and `domain/src/client/gateway-mapping.ts:201-209`

- **What changed in Core.** Core commit `0e6d3ac` (at Core HEAD) made
  `normalizeAutomationStudioElementTarget` read `parameters.element`
  (`model/action-element-target.ts:80`, `:125-127`). It merges
  `normalizeFingerprint(element)` with the parameters' own signals. The recording
  mapper (`runtime/service/recordings/proposal-candidates.ts:158-162`) builds
  `parameters.target` that way when an element is present.
- **Why the recording still wins.** Core's fingerprint
  (`action-element-target.ts:129-154`) has no `context`, `checked`, `name`,
  `href`, `inputType` or `value`, folds `implicitRole` into `role`, and writes
  no `element` back. So the adapted fingerprint is still a lossy copy of the
  recorded element, and the ordering both comments justify is unchanged.
- **What the comments now say:** exactly that. The 11/1/11 and 11-then-1
  measurements are kept, labelled as taken before Core read the element. No new
  count is claimed, because none was measured.
- **Size:** `gateway-mapping.ts` is 9 lines in and 9 out, and stays at 413
  lines, its HEAD length. `targets.ts` is 12 in and 12 out.

### `apps/extension/src/content/actions/assert.ts:34-44`, the header

- **Old claim:** `authGateFailure` fires only when the selector matches nothing,
  and the failed-URL-claim case was called "narrow".
- **At HEAD it fires in two cases.** Both require a sign-in gate on the page
  (`results.ts:278-291`): the selector matches nothing, or the action is a `url`
  claim that names a URL and did not hold (`namedUrlClaim`, added by `w19-e2`).
- **New wording:** it says so, and says that for this verb it is no longer a
  narrow edge, because every failed URL claim on a sign-in gate takes that hook.
- **Size:** one line longer. The file is not baselined.

### `packages/test-runner/src/bench/render-markdown.ts:154`

- **The change:** the sentence `reports/g-bench-evidence-size.md` proposes is
  inserted verbatim. It says:
  - sanitized packet bytes and the truncation count come from Flow-lane runs
    only;
  - raw snapshot bytes has no samples on any lane and is not a Week 1 metric.
- **Accuracy:** checked against `bench/evaluate-run.ts:20`. The line still
  starts `Truncation count, all lanes: 0.`, which is what
  `render-markdown.test.ts:58` asserts.

### `packages/test-runner/src/run-evaluation/observed-run-evaluation.ts:31-38` (amendment)

- **The new wording** is `g-single-run-evidence`'s proposal, adjusted to the
  tree as it stands now. Both Flow-lane producers pass the sizes, read by
  `flowLaneEvidenceSizes` from `snapshots/flow-lane.json`: the bench
  (`bench/evaluate-run.ts`) and a single `lab run` (`single-run-evaluation.ts`).
- **Why it was adjusted.** Between my first read and the final check,
  `g-single-run-evidence` moved the reader into
  `run-evaluation/flow-lane-evidence-sizes.ts:30`. It is called from
  `bench/evaluate-run.ts:106` and `single-run-evaluation.ts:61`, the latter only
  for `lane === "flow"` with a `bundlePath`. So I added the reader's name.
- **Dependency:** this is true only with `g-single-run-evidence`'s uncommitted
  change. Lines `:47-52` of the same file are still stale (Open questions).

## Commands run and observed results

All from `F:\!FluxIQWebExtension` unless stated. Exit statuses were captured by
redirecting to a file, never through a pipe. The labels were
`EXTENSION_TEST_BUILD_LABEL=igf` and `DOMAIN_TEST_BUILD_LABEL=igf`.

1. **`test:content` at HEAD, before the fix.**
   - **`pnpm --filter @fluxiq-web-extension/extension test:content -- e2e/content/tests/identity-veto.spec.ts --list`**
     → exit 0. The echoed command ended in `"--" "e2e/content/tests/identity-veto.spec.ts" "--list"`,
     and it printed `Running 4 tests using 4 workers` and `4 passed (5.4s)`. So
     the `--list` was ignored and the tests ran.
   - **`… test:content -- e2e/content/tests/identity-veto.spec.ts`** → exit 0,
     `4 passed (2.7s)`.
   - **`… test:content -- --list`** → exit 1, `Error: No tests found.`
   - **`… test:content e2e/content/tests/identity-veto.spec.ts --list`** (no `--`)
     → exit 0, `Total: 4 tests in 1 file`.
2. **The node argv probe:** `node -e "console.log(JSON.stringify(process.argv.slice(1)))" -- -- e2e/x.spec.ts --list`
   → `["--","e2e/x.spec.ts","--list"]`. With `-- --workers=2 e2e/x.spec.ts` it
   gave `["--workers=2","e2e/x.spec.ts"]`.
3. **`test:content` after the fix.**
   - **A.** `… test:content -- e2e/content/tests/identity-veto.spec.ts` → exit 0,
     `Running 4 tests using 4 workers`, `4 passed (3.2s)`. This is the brief's
     required check.
   - **B.** `… test:content -- --list` → exit 0, `Total: 218 tests in 24 files`.
   - **D.** `… test:content -- --workers=2 e2e/content/tests/identity-veto.spec.ts`
     → exit 0, `Running 4 tests using 2 workers`, `4 passed (2.8s)`.
   - **E.** `… test:content --workers=2 e2e/content/tests/identity-veto.spec.ts`
     (no `--`) → exit 0, `Running 4 tests using 2 workers`, `4 passed (3.1s)`.
4. **Cast probe, all three casts removed.**
   - **`pnpm exec tsc -p tsconfig.test.json` in `domain`** → exit 2, with the
     `domain.test.ts(99,3)` and `project.test.ts(46,98)` errors quoted above.
   - **The same in `apps/extension`** → exit 2, with `forms.test.ts(150,5)` TS2739.
   - **Afterwards:** two casts restored, and
     `git diff -- …/project.test.ts …/forms.test.ts` printed nothing.
5. **`pnpm --filter @fluxiq-web-extension/domain check`.**
   - **First run:** exit 2, `domain.test.ts(77,5): error TS2322: Type 'false' is
     not assignable to type 'true'`.
   - **After `armPending: true`:** exit 0.
6. **`DOMAIN_TEST_BUILD_LABEL=igf pnpm --filter @fluxiq-web-extension/domain test`**
   - **First run:** exit 0.
   - **After the fixture change:** exit 0, `# tests 352`, `# pass 352`,
     `# fail 0`. This includes `ok 96 - every state path a producer writes is
     declared` and `ok 97 - every declared state path is written by a producer`.
7. **`pnpm --filter @fluxiq-web-extension/extension check`** → exit 0. The output
   is only the two `tsc` lines.
8. **`EXTENSION_TEST_BUILD_LABEL=igf pnpm --filter @fluxiq-web-extension/extension test`**
   → exit 0, `Extension smoke test passed.`, `# tests 395`, `# pass 395`,
   `# fail 0`.
9. **From `packages/test-runner`:**
   - **`pnpm check`** → exit 0. `domain:dist` found an existing dist.
   - **`pnpm exec tsc -p tsconfig.json --outDir dist-igf`** → exit 0, no output.
   - **`node --test "dist-igf/**/*.test.js"`** → exit 0, `# tests 502`,
     `# pass 502`, `# fail 0`.
   - **`rm -rf dist-igf`** → confirmed absent. This ran against
     `g-single-run-evidence`'s in-flight tree.
10. **Content harness list, from `apps/extension`:**
    `pnpm exec playwright test -c e2e/playwright.content.config.ts --list` →
    exit 0, `Total: 218 tests in 24 files`.
11. **`node scripts/structure-audit.mjs`** → exit 1,
    `structure-audit: 2 violation(s) across 1 rule(s)`. Both are `working-docs`
    findings in files I did not touch:
    - `FAIL [working-docs] docs/working/mvp-week1-web-automation-reliability-plan.md:
      819 lines exceeds the 800-line compaction threshold`. At HEAD it is 769
      lines. `git diff --stat` shows `+50` uncommitted lines, from the
      supervisor's edits.
    - `FAIL [working-docs] docs/working/README.md is out of date with the
      documents' header blocks`. The README is unmodified.
    - **Audit lines on my files:** only advisory warnings that predate my
      changes, `identity-fixtures.ts: 14 exported values` and
      `gateway-mapping.ts: 413 lines`. `git show HEAD:` also gives 413.
12. **Cleanup:** `domain/.test-build-scratch/igf` and
    `apps/extension/.test-build-scratch/igf` were removed. The scratch outputs
    are in the session scratchpad on C:, outside the repository.

## Not verified

- **No guard was added or changed**, so there is no mutation proof. Every change
  is a comment, a document, a test-data value, a type annotation, or the
  `test:content` script.
- **The fixed script under POSIX `sh`** (Linux or macOS) was not run, only under
  pnpm on Windows. The inline code avoids `$`, backticks and double quotes, so
  `sh` should pass it through unchanged, but that is not observed.
- **The full content harness** was not run through the fixed script. Only
  `identity-veto.spec.ts` (4 tests) ran, three times, and `--list` covered all
  218 tests.
- **Root gates were not run as a whole.** Root `pnpm check` (its
  `structure:test` and `lab:test` steps) and root `pnpm test` did not run; only
  the per-package gates above did.
- **Core's element reading at dispatch** was read from source, not run. At
  dispatch, `prepareElementTargetAction` (`io-policy.ts:201-202`) reads
  `parameters.target` first. So a node whose stored target is a plain,
  non-canonical object would not get the element's signals. Recorded nodes
  built by the mapper do. The comment does not claim a new signal count. The
  extension's link to Core's built `dist` was not rebuilt, which is the
  supervisor's step.
- **Lab.** Only one change is visible to a Lab run. A `lab bench` run's
  `report.md` "Distributions, all lanes" section should end with the new
  sentence, from "Sanitized packet bytes and the truncation count come from
  Flow-lane runs only" through "Week 2 metrics … are null.". Nothing else here
  changes Lab behaviour or output.

## Open questions or contradictions found

1. **`observed-run-evaluation.ts:47-52` is still stale.** It says "only the
   bench's Flow lane reads evidence sizes, from the run bundle". The amendment
   gave me only `:32-36`, so I left it. `g-single-run-evidence`'s report,
   question 4, proposes "and both producers' Flow lanes read evidence sizes from
   the same bundle file".
2. **`failure-taxonomy.md` has two more stale spots, outside the lines I owned.**
   - The Result builders bullet (`:121-123`) describes `AUTH_REQUIRED` only as
     "a target that matched nothing on a document that is a sign-in gate". Since
     `w19-e2`, a failed `url` claim that names a URL on a sign-in gate also
     produces it (`results.ts:280`).
   - The Dispatch bullet (`:124-132`) still omits the mapping's
     `USER_INTERVENTION_REQUIRED`. The new paragraph names it, but the bullet
     does not.
3. **"The four helpers" in the `identity-fixtures.ts` header** may be stale. The
   file exports six functions: `describe`, `recordedElement`, `armMode`,
   `documentRect`, `viewportRect` and `visualTarget`. The brief named only the
   spec count.
4. **Two casts remain because their fixtures are partial on purpose**
   (`project.test.ts:47`, `forms.test.ts:151`, compiler output above). Removing
   them means narrowing the cast, for example to just `controls`, or completing
   the fixture. That is a test-design choice, not a stale cast. A similar cast I
   did not own or try is at `domain/src/tests/page-evidence-joinery.test.ts:116`.
5. **The `armPending` fixture value changed from `false` to `true`.** It is the
   one test-data change in this dispatch. The supervisor should accept it or ask
   for the cast back. Path coverage is unchanged.
6. **Three places still describe the old `test:content` trap, in files I do not
   own:**
   - the plan's operating rules (`mvp-week1-web-automation-reliability-plan.md:150`);
   - `live-validation-plan.md:69-72`;
   - the binding rules at the top of `briefs/finish-week1.md`.

   The `--` form now forwards flags. The bare `pnpm exec` command and the
   `run test:content --workers=4` form still work, and form E above proves the
   latter.
7. **No structure-baseline entry should change.** None of my files is baselined,
   and no count grew past a limit.
