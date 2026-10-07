# fix-judges-c: judges see the page before what they judge (`startView`)

## Outcome

Partial. The code is finished and tested. One wiring line belongs in `service.ts`, which this brief must not touch, so the lead has to add it. Until then a finished run's check carries no `startView` live. The build-test path needs no other change and works end to end.

## What changed and why

R = `packages/fluxiq/src/programs/automation-studio/runtime` in Core (`fxwork/t286/!FluxIQ`).

- `R/result-verification/contracts.ts`: the summary gains `startView?: AutomationStudioResultEndView`. It is the same view type as `endView`, and the doc comment says where each judge's copy comes from.
- `R/result-verification/result-summary.ts`:
  - The input gains `observedStateKeys`. `sessionAttempts` is now typed locally as `TracedAttempt`, which adds `beforeAction`/`afterAction.summary` and is a structural superset of what `step-changes.ts` reads.
  - The new private `startedOn()` finds the first attempt that captured the page; earlier model or code steps saw no page and changed nothing. If that step's `stateDiff` says it moved to another document (`documentChanged`, or `locationChanged` when `documentChanged` is absent), it takes the `afterAction` snapshot. Otherwise it takes the `beforeAction` snapshot.
  - Only the declared top-level view keys are kept, as `service/end-view/look.ts` does. The result is screened through `automationStudioResultEndView`, the same screen the end view uses, so a withheld view sets `withheld`.
  - There is no `startView` when nothing was captured, when no view keys were declared, or when there is no snapshot on the chosen side.
  - It is a private helper, so the file's exported-value count is unchanged. The file is now 400 lines, right at the advisory threshold.
- `R/result-verification/run-outcome.ts`:
  - New port `observedStateKeys?: readonly string[]`.
  - It is passed into the summary next to `sessionAttempts`.
  - The file is now 800 lines, exactly at the limit. That passes, because only more than 800 fails, but no headroom is left.
- `R/llm/node-tools/dry-run-gate.ts`:
  - The report gains `startView`.
  - Before each replay, after `lastingActs`, the gate looks once through the existing `input.endView` hook. The call has no `after` and callId `core.dry_run.<n>.start_view`. The end look keeps `core.dry_run.<n>.end_view`.
  - A look that fails or times out becomes `undefined`. It never fails the test.
  - A reuse reports the clean replay's own `startView`.
  - The look runs before anything says whether the replay will pass, so a refused replay also costs one look, which goes unused.
  - `evidence-loop.ts` and `loop-configuration.ts` are untouched: the hook was already wired through `testEndView`.
- `R/result-verification/build-test/summary.ts`: new `startView` input, screened like `endView`, and set on the summary.
- `R/service/flow-bootstrap-commands/build-judge.ts`: passes `judgedTest.startView` into `automationStudioBuildTestResultSummary`.
- `R/llm/diagnosis-instructions.ts`:
  - **Finished run.** The end-view clause now reads "do not suppose a step left undone what the view shows done and startView did not already show". A new sentence follows: "resultSummary.startView, where present, is the same view of the page before the run did anything: what it already shows -- a count, an item in a cart, a collected coupon, a chosen store -- predates the run and is not its doing; credit an act only where startView and endView differ on it or the act's own step shows it."
  - **Build test.** The "may predate the test" sentence is rewritten. It keeps its opening ("The test started from a page that kept what the build did while it explored, and going back ... undoes nothing that lasts."). Then: "resultSummary.startView, where present, is that page just before the test did anything: what it already shows ... predates the test and is not its doing, so credit an act only where startView and endView differ on it or the act's own step shows it; what a withheld step's effect shows ... is exploration's doing, not proof the Flow does it."
  - New source comments give the evidence runs.
- `R/llm/deepseek/tests/system-prompt-pins.json`: re-pinned. The finished-run text changed in `loop_verification` and `loop_verification_build_test`; the build-test text changed in `loop_verification_build_test`. The edit was byte-level and kept the file's CRLF line endings.
- `R/llm/harness/request-evidence-check.ts`: unchanged. It has no allowlist of summary keys, and `credentialFree` already covers the whole summary. A test confirms that a request carrying `startView` is not refused.
- Tests:
  - `result-verification/tests/judge-sees-the-end.test.ts`: 5 new tests. They cover a navigating first step whose start page shows a cart count, the document vs location rule, none when nothing was captured or no keys were declared, screening and `withheld`, and the full `verify` path through the port and session trace, including the evidence check.
  - `result-verification/build-test/tests/end-view.test.ts`: 1 new test. A summary given a start look carries it screened; a denied key withholds it.
  - `llm/node-tools/tests/dry-run-gate-end-view.test.ts`:
    - 3 existing tests updated, because a start look now precedes the end look and a refused replay now makes the start look only.
    - 2 new tests. One checks that the start look comes before the replay's first call, carries no `after`, and lands on the report. The other checks that a failure, a `TimeoutError` or an empty look gives no `startView` and the test still passes.
  - `service/flow-bootstrap-commands/tests/build-judge.test.ts`: 1 new test checking that the judge request carries `startView` and `endView`. The test of a run without a look now also asserts there is no `startView`.
  - `llm/tests/diagnosis-channel.test.ts`: 2 new tests checking that each judge's system prompt, built by `automationStudioDeepSeekSystemPrompt`, carries its sentence. The existing build-test assertion now also asserts that "may predate the test" is gone.

## Commands run and observed results

All from `packages/fluxiq`.

- **Baseline, before any change.** `npx vitest run` on judge-sees-the-end, build-test end-view, dry-run-gate-end-view, build-judge, diagnosis-channel and deepseek system-prompt: 6 files and 75 tests passed.
- **Red, after the tests were added.**
  - dry-run-gate-end-view: 4 failed, for example `expected [ 'core.dry_run.1.end_view' ] to deeply equal [ 'core.dry_run.1.start_view', …(1) ]` and `expected 'dryrun.1.reset' to be 'core.dry_run.1.start_view'`.
  - diagnosis-channel: 3 failed, for example `expected 'Return exactly one JSON object…' to contain 'resultSummary.startView, where presen…'`.
  - end-view: 1 failed, `expected undefined to deeply equal { Object (view) }`.
  - build-judge: 1 failed, same message.
  - judge-sees-the-end: 4 failed. The "none" test passed while red, as it should.
- **Green, the same six files.** 6 files and 86 tests passed.
- **Wider sets the brief requires.** `npx vitest run R/result-verification R/llm/tests/diagnosis-channel.test.ts R/llm/deepseek/tests R/llm/node-tools/tests/dry-run-gate.test.ts R/llm/node-tools/tests/dry-run-gate-loop.test.ts R/llm/node-tools/tests/dry-run-gate-end-view.test.ts R/service/flow-bootstrap-commands/tests/build-judge.test.ts R/service/end-view`: 56 files and 601 tests passed. This ran against the tree as it stood, with other workers' concurrent edits in it.
- **Typecheck.** `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check-t286c.tsbuildinfo`: exit 0 and no output, so no errors in any file.

## Not verified

- The finished-run `startView` live. That needs the `service.ts` line below; with it absent the port is `undefined` and no `startView` is sent. No Lab, browser or provider runs were made.
- That the web domain's real snapshot `summary` keys overlap `WEB_LLM_VIEW_KEYS`. I read `publishedWebLlmPage` downstream, which carries `page` and `location`, but did not run it.
- The structure audit and `fluxiq:check` were not run, per the brief. Both are for the lead.
- The evidence-loop tests were not run. Nothing there references `endView`/`testEndView`, but each passing build test now makes one extra look (up to 10 s on timeout), and each refused one does too.

## Open questions or contradictions found

1. **The `service.ts` change the lead must make.** In the `resultPorts` literal (about line 2536), next to `deniedEvidenceKeys`, add:
   `...(this.llmEvidenceRuntime?.observedStateKeys?.length ? { observedStateKeys: this.llmEvidenceRuntime.observedStateKeys } : {}),`
   The finished-run check needs the domain's declared view keys to cut its snapshot down to the view, and its ports had no way to receive them.
2. **"First attempt" is read as the first attempt that captured the page**, not `attempts[0]`. The web domain declines snapshots for non-page nodes, so an LLM or code step can come first without a snapshot, and it cannot have changed the page.
3. **`run-outcome.ts` is at exactly 800 lines**, the fail limit. The next addition there needs a split first.
4. **The build test's `startView` is taken before the replay's reset navigation.** It is the page exploration left, which may be a different page from where the Flow starts. The build-test sentence says so ("that page just before the test did anything").
5. **The finished-run sentence also reaches the build-test judge**, because the result-verification paragraph is shared and says "the run". The build-test sentence right after it narrows it to the test.

```text
Outcome: Partial
Changed: R/result-verification/{contracts,result-summary,run-outcome}.ts, R/result-verification/build-test/summary.ts, R/llm/node-tools/dry-run-gate.ts, R/service/flow-bootstrap-commands/build-judge.ts, R/llm/diagnosis-instructions.ts, R/llm/deepseek/tests/system-prompt-pins.json, tests: result-verification/tests/judge-sees-the-end.test.ts, build-test/tests/end-view.test.ts, llm/node-tools/tests/dry-run-gate-end-view.test.ts, service/flow-bootstrap-commands/tests/build-judge.test.ts, llm/tests/diagnosis-channel.test.ts
Validation: `npx vitest run` on result-verification, diagnosis-channel, deepseek/tests, the dry-run-gate tests, build-judge and end-view -> 56 files, 601 tests passed; `npx tsc --noEmit ... check-t286c.tsbuildinfo` -> exit 0, no errors
Not verified: finished-run startView live (needs the service.ts port line); structure audit and fluxiq:check not run (lead's); no live or Lab run
Report: C:/Users/osrs_/FluxStuff/fxwork/t286/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/fix-judges-c.md
Notes: The lead must add to service.ts resultPorts: ...(this.llmEvidenceRuntime?.observedStateKeys?.length ? { observedStateKeys: this.llmEvidenceRuntime.observedStateKeys } : {})
run-outcome.ts is now exactly 800 lines (the limit)
The gate now makes a start look before every replay, refused ones included
```
