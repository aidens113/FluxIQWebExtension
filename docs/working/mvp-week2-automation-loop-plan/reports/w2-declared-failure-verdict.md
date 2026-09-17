# A declared failure decides the verdict

Brief: a scenario or variant whose declared outcome is a failure must pass when
it reports exactly that failure. Source: `w2-wrong-row-acted-on.md` section 7
item 1.

## 1. Outcome

**Done**, for everything I own. One change is needed in `run-scenario.ts`, which
the brief excludes from my files; it is a ready diff in section 6, and until it
lands `run.json`, `summary.json`, the `lab run` exit code and the JSON line
`lab run` prints still carry the runner's own verdict while `evaluation.json`
carries the judged one. One documentation insert is in section 7.

## 2. The rule as implemented

`packages/test-runner/src/run-evaluation/declared-failure-verdict.ts`, new,
applied in `evaluateObservedRun` before the evidence budget:

> When the resolved workflow declares `expected.failure`, the run passes by
> reporting **exactly** that failure — the same category, and the same code
> when one is declared — and fails by reporting a different failure, reporting
> none, or succeeding. Nothing changes when nothing is declared.

Three things the declaration deliberately does **not** override, each of which
would otherwise be a hole in the very cases negative variants exist to catch:

1. **A failed oracle.** `member-left` declares that nothing was pressed on
   another member (`dialogClosed`, `noToast`, the unchanged roster). The lane
   consults the oracle before it asserts anything (`run-flow-lane.ts`), so a run
   that refused *and* mutated the page has a matching failure record and a
   failing oracle. The oracle wins.
2. **A rig failure on any other axis.** The declaration answers only for the
   test-rig categories raised because an action did not succeed —
   `action.dispatch` and `action.targeting`. A negative variant that leaks a
   secret (`security.redaction`), leaves the wrong final state
   (`runtime.behavior`), or breaks its recording, extension or gateway still
   fails on that. The brief's rule read literally would pass all of them; I
   narrowed it, because "the automation must refuse" is not "the rest of the run
   may break".
3. **A facility failure, and an `inconclusive` run.** The rig broke, so the run
   observed nothing about the refusal either way. (The contract also refuses a
   facility diagnostic beside any automation result at all.)

A run judged by the declaration carries one judgement invariant, keeping the id
`runner-verdict` so anything reading invariants by id keeps working, restated in
the declaration's terms and keeping what the runner itself had said — which is
otherwise lost, since a passed evaluation may carry no `failureCategory`:

```
before  verdict failed (action.dispatch)
        {"id":"runner-verdict","passed":false,"expected":"passed",
         "actual":"failed: action.dispatch","evidenceSequences":[19]}
after   verdict passed
        {"id":"runner-verdict","passed":true,
         "expected":"the declared failure target_not_found/web.target.not_found",
         "actual":"reported target_not_found/web.target.not_found; the runner failed the run: action.dispatch",
         "evidenceSequences":[19]}
```

That is `run-mu5vfd6o-d98abd77`'s own `evaluation.json`, re-judged through the
built module (section 5).

### Why that run failed at all

The declaration is not what failed it. `member-left` inherits
`expected.actions: [{ web.dom.click, succeeded }, { web.dom.select, succeeded }]`
from the workflow it arms — a variant replaces only the `expected` fields it
sets — so the correct refusal failed `assertFlowActions`:
`summary.json` `firstFailure`: *"The Flow did not produce a web.dom.click action
with outcome succeeded; it produced web.dom.click:failed"*, category
`action.dispatch`. That is exactly the inherited expectation the declaration now
answers for, and the reason `action.dispatch` is in the overridable set.

## 3. What I changed, and what already agreed

Changed (mine):

| File | Change |
| --- | --- |
| `packages/test-runner/src/run-evaluation/declared-failure-verdict.ts` | New. The rule, its reasoning, and `reportsDeclaredFailure`. |
| `packages/test-runner/src/run-evaluation/observed-run-evaluation.ts` | Applies it, before the evidence budget, so a packet over budget still fails a declared-failure run as `performance.budget`. |
| `packages/test-runner/src/run-evaluation/run-outcome.ts` | Exports `RUNNER_VERDICT_INVARIANT` (was a private const) so one id is stated once. |
| `packages/test-runner/src/run-evaluation/index.ts` | Barrel entry. |
| `packages/test-runner/src/run-evaluation/tests/declared-failure-verdict.test.ts` | New, 8 tests (section 4). |
| `scripts/lab/live-campaign/row/summarize-task.mjs` | The row's `verdict` is now `evaluation.json`'s, falling back to the Lab's printed result only for a run with no evaluation (the existing and clone targets publish none). A passed run carries no `failureCategory` and no `runnerMessage`. New row field `declaredFailure`. |
| `scripts/lab/live-campaign/summary/markdown.mjs` | The Failure column marks a reported failure `as declared: <category>/<code>` when it is the one the scenario declared; the totals sentence states the rule. |
| `scripts/lab/live-campaign/row/tests/summarize-task.test.mjs` | New test over the row and the rendered table. |

Already agreed, checked and unchanged:

- **`bench/aggregate-report.ts`** — every rate that reads `verdict` (`executed`)
  applies only to `positive` runs (`automationFailureExpected === null`), so no
  Week 1 Metrics rate moves. `failureClassificationAccuracy` already judges
  negatives by classification alone.
- **`bench/evaluate-run.ts`, `bench/run-bench.ts`** — both producers of a
  `RunEvaluation` go through `evaluateObservedRun`, so a bench row and a single
  `lab run` cannot read a correct refusal differently. `runs.json`'s per-row
  `verdict`, the bench's pass counts and `failure-cause.ts` follow from it.
- **The campaign row's `succeeded`** — a creation task succeeds on its run's
  verdict, which is now the judged one; a repair task still succeeds on its
  judgement (`repairJudgement`), which reads `oracleVerdict`, not the verdict.
  `member-directory-refuse-departed-member` is a repair task, so this fixes the
  Verdict column and the `passed`/`failed` totals for it, not its judgement.
- **`packages/test-runner/src/run-expectations/**`** — the declaration does not
  live there (that module is console errors, recorded events and extraction).
  It lives on `ScenarioExpected.failure` in `test-contracts/src/scenario.ts` and
  is asserted by `flow-lane/expectations.ts` `assertFlowFailure`, which is
  another worker's file and needed no change: it already passes a run that
  reports the declared failure.

Not agreed yet: `run-scenario.ts` (section 6) and `docs/architecture/testing-facility.md`
(section 7).

## 4. Tests

`packages/test-runner/src/run-evaluation/tests/declared-failure-verdict.test.ts`,
written before the change and driven through `evaluateObservedRun` (the seam
both producers use), with every case also re-parsed through
`parseRunEvaluationJson` so a verdict the contract would refuse cannot pass:

1. a declared-failure variant reporting that failure **passes**, with the
   restated invariant and no `failureCategory`;
2. a declaration with no code is met by the category alone; a declared code must
   match;
3. a **different** failure fails; a **different code** fails;
4. **no failure** fails; **succeeding** fails, as `runtime.behavior` (the run
   had no category of its own);
5. a **failed oracle** is never overridden; an unconsulted oracle is not a
   failing one;
6. `runtime.behavior`, `security.redaction`, `recording.contract` and
   `environment.missing` are **not** overridden and keep the runner's invariant
   untouched; `action.targeting` is;
7. a facility-failed run is untouched, and the same run without the diagnostic
   is judged;
8. an **ordinary scenario** — passing and failing — is judged exactly as before,
   invariants included.

`scripts/lab/live-campaign/row/tests/summarize-task.test.mjs` adds the row side:
the evaluation's verdict wins over the Lab's printed `failed`/`action.dispatch`,
`succeeded` is true, the category and runner message are dropped, the rendered
table says `as declared: target_not_found/web.target.not_found`; a run that
refused differently reads as the failure it is and is not marked as declared; an
ordinary run and a run with no evaluation still read the printed verdict.

## 5. Commands run and observed results

```
pnpm --filter @fluxiq-web-extension/test-runner test
  -> exit 0; # tests 1157  # pass 1157  # fail 0  (duration_ms 25538)
pnpm lab:test
  -> exit 0; # tests 74  # pass 74  # fail 0
node scripts/structure-audit.mjs
  -> exit 0; structure-audit: passed (63 warning(s), 122 baselined)
     No warning names a file I added or changed.
```

Re-judging the real bundle, through the built module, printing
`evaluation.json`'s recorded verdict and the one the current rule gives it:

```
node <scratch>/reeval.mjs F:/!FluxIQWebExtension/test-runs/run-mu5vfd6o-d98abd77
  before: verdict failed (action.dispatch)
    invariant {"id":"runner-verdict","passed":false,"expected":"passed","actual":"failed: action.dispatch","evidenceSequences":[19]}
  after : verdict passed
    invariant {"id":"runner-verdict","passed":true,"expected":"the declared failure target_not_found/web.target.not_found","actual":"reported target_not_found/web.target.not_found; the runner failed the run: action.dispatch","evidenceSequences":[19]}
```

An earlier full-suite run (before the last edits) reported 9 failures, all in
`dist/tests/*` that shell out to `dist/cli.js`, every one
`ERR_MODULE_NOT_FOUND` for `F:\!FluxIQ\packages\fluxiq\dist\api-contracts\index.js`
or `.../programs/automation-studio/index.js` — Core's `dist` being rebuilt
underneath the run. They are gone in the runs quoted above and touch nothing I
changed. One of that run's failures *was* mine (a test fixture that paired a
facility diagnostic with an automation result, which the contract refuses); it
is fixed and the case is now shaped the way a real facility failure is.

## 6. Needed elsewhere: `run-scenario.ts` (not my file)

`evaluation.json` is now judged, but the runner's own verdict still drives
`run.json`, the finalized bundle's `summary.json`, the JSON line `lab run`
prints and its exit code (`cli.ts:101`), and `lab inspect` (which reads
`run.json`). So a correct refusal currently reads `passed` in `evaluation.json`
and `failed` everywhere else — which the campaign summary now resolves in
favour of the evaluation, and a human reading `run.json` does not.

The evaluation is the single judge, so `run-scenario.ts` should adopt its
verdict. `singleRunEvaluation` reads the manifest only for `durationMs`, so the
manifest can be built, judged, and then written with the judged verdict:

```diff
@@ packages/test-runner/src/run-scenario.ts  (the bundle.publish block, ~line 580)
-    const manifest = await createRunManifest({ ...unchanged..., verdict, ... });
-    assertRunManifest(manifest);
-    await bundle.writeStructured("run.json", manifest);
-    const metrics = { steps: workflow.recordingScript.length };
+    // Built first and written after the evaluation has judged it: a run whose
+    // scenario declares the failure it must report passes by reporting exactly
+    // that failure, and `run.json`, the finalized bundle and what `lab run`
+    // prints must say the same thing `evaluation.json` does.
+    const provisional = await createRunManifest({ ...unchanged..., verdict, ... });
+    const metrics = { steps: workflow.recordingScript.length };
     const observation = selectLaneObservation({ ...unchanged... });
     const evaluation = observation
-      ? singleRunEvaluation({ runId, verdict, failureCategory, ..., manifest, ... })
+      ? singleRunEvaluation({ runId, verdict, failureCategory, ..., manifest: provisional, ... })
       : undefined;
+    // `inconclusive` is never produced here; it is excluded so the runner's
+    // own verdict stands if it ever is.
+    const judged = evaluation && evaluation.verdict !== "inconclusive" ? evaluation.verdict : verdict;
+    const manifest = judged === verdict ? provisional : { ...provisional, verdict: judged };
+    assertRunManifest(manifest);
+    await bundle.writeStructured("run.json", manifest);
     if (evaluation) await bundle.writeStructured("evaluation.json", evaluation);
     if (benchReceipt) await bundle.writeStructured("bench-receipt.json", benchReceipt);
     bundle.registerEvidencePolicy(evidence.capture);
-    const finalized = await bundle.finalize({ verdict, metrics });
-    return { runId, verdict, path: finalized.path, ..., ...(failureCategory ? { failureCategory } : {}) };
+    const finalized = await bundle.finalize({ verdict: judged, metrics });
+    return { runId, verdict: judged, path: finalized.path, ...,
+             ...(judged !== "passed" && failureCategory ? { failureCategory } : {}) };
```

Two notes for whoever applies it. `RunScenarioResult.verdict` is typed
`"passed" | "failed"`, which `judged` satisfies once `inconclusive` is excluded.
And `bench/run-bench.ts:444` rebuilds a result from the finalized bundle and
re-judges it through `evaluateFlowRun`, so it agrees either way.

## 7. Needed elsewhere: the facility document

`docs/architecture/testing-facility.md` states the assertion order and what
`evaluation.json` holds, and now understates it. Not my file by the brief;
suggested insert, after the `evaluation.json` paragraph that ends
*"`rawSnapshotBytes` stays empty, because no producer measures raw snapshots."*:

> A scenario or variant that declares `expected.failure` is judged by whether
> the run reported exactly that failure — the same category, and the same code
> when one is declared — rather than by whether the run succeeded, because its
> expectations are inherited from the workflow it arms and expect the actions to
> succeed. The run's single judgement invariant keeps the id `runner-verdict`
> and states the declaration as its `expected`. A different failure, no failure,
> or a run that succeeded fails. The declaration does not override a failed
> fixture oracle, a facility failure, or a rig failure outside
> `action.dispatch` and `action.targeting`: it says the automation must refuse,
> not that the rest of the run may break.

The bullet at line ~1001 (`expected.failure` … "fails as `runtime.behavior`")
stays true: that is still how `assertFlowFailure` fails the run.

## 8. Not verified

- **No live Lab run.** I did not rerun `member-directory` / `member-left` on the
  flow lane. Three reasons: another worker owns `apps/extension` and `domain`
  and a Lab run builds both, so a run now would fold their in-flight edits into
  my evidence; Core's `dist` was being rebuilt underneath this session (the
  `ERR_MODULE_NOT_FOUND` failures in section 5); and until section 6 lands the
  printed verdict would still be the runner's, so the run would not show the
  thing under test anyway. Instead I re-judged that run's real recorded
  evaluation through the built module (section 5), which exercises the same
  code path with the same inputs.
- **No provider calls**, live or otherwise.
- The `member-left` end-to-end reading — run record, campaign summary and
  dashboard all saying the same thing — is verified in unit tests and by
  re-judging the bundle, not by a campaign run.
- I did not run `pnpm check`, `pnpm test` or `pnpm build` repository-wide; other
  workers' files are mid-edit in this tree.

## 9. Open questions and contradictions found

1. **The brief's rule, read literally, is wider than what I implemented.** It
   says the verdict "is decided by whether the run reported that exact failure".
   Taken literally, a negative variant that refuses correctly *and* leaves the
   wrong final state, or leaks a secret, would pass. I restricted the override
   to the oracle-clean case and to `action.dispatch` / `action.targeting`
   (section 2). If the supervisor wants the literal rule, the change is to widen
   `ACTION_OUTCOME_CATEGORIES` and drop the oracle condition in
   `declared-failure-verdict.ts`, and four tests pin the current choice.
2. **`member-left` inherits action expectations it cannot meet.** The variant
   inherits `{ web.dom.click, succeeded }`. The verdict rule makes that harmless,
   but the variant still declares expectations that contradict its declared
   failure. The alternative fix — letting a variant that declares a failure
   inherit no `expected.actions`, or having `assertFlowActions` skip outcomes on
   a declared-failure run — lives in `flow-lane/expectations.ts` and the scenario
   manifest, neither mine. It is worth deciding, because with the verdict rule in
   place those inherited expectations are now judged and then ignored.
3. **One real hole I could not close from here: a Flow that starts at the wrong
   recorded action.** Three flow-lane assertions share the category
   `action.dispatch`: `assertFlowStartedAtFirstAction`,
   `assertFlowDidNotStopEarly` and `assertFlowActions`. The declaration now
   answers for all three.

   - *Stopped early* cannot collide with it: `stopWithoutFailedAttempt`
     (`persisted-flow-run.ts:367`) is set only when **every** attempt succeeded,
     and a declared failure requires a failed one. Verified in the source.
   - *Started at the wrong action* **can**: a Flow that began at recorded action
     3, then refused with exactly the declared failure, now passes. The
     evaluation cannot see it — `startCandidateIndex` goes into
     `snapshots/flow-lane.json` but not into `RunLaneObservation`, which is what
     `evaluateObservedRun` judges.

   Two ways to close it, both outside my files: put `startCandidateIndex` on the
   `RunLaneObservation` and make the rule require it to be 0 or absent, or give
   the two ordering assertions a category the declaration does not answer for
   (they are about where the recording ran, not about an action's outcome).
   I would take the second: it is one word per throw in
   `flow-lane/run-flow-lane.ts` and needs no new contract field.
