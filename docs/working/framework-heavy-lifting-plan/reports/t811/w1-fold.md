# t811 / w1-fold: fold the test into core.submit_subflow, and complete after a yes

## Outcome

Partial. The code and tests are written, but none of the three acceptance commands has run. My vitest run was still waiting for `lab-slots/heavy-check.lock` when I was told to hand back. Another lane took the lock at 23:28:34 and still held it at 23:33:41. tsc and the structure audit were never started.

## What changed and why

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t811/!FluxIQ`. Paths below are relative to `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/subflow-candidate/`.

- `submit-then.ts` (new): `AUTOMATION_STUDIO_SUBFLOW_SUBMIT_THEN`.
  - `properties(trials, fromStep)` adds `then` to the schema only where a port exists. The `{from}` variant and `fromStepImpossible` appear only where the port can run from a step.
  - `read(value, fromStep)` removes `then` and `fromStepImpossible` from the submission.
  - A `then` Core cannot read is refused with `subflow.submit_then_invalid` before anything is submitted.
  - `fromStepImpossible` is passed to the gate only beside `"test_whole"`. Anywhere else it is set aside, and the answer's `setAside` says so.
- `submit-then-words.ts` (new): all new model-facing wording, in generic terms. I did not touch `repair-words.ts`.
- `builder-test-call.ts` (new): `automationStudioSubflowBuilderTest`.
  - It is the old `core.test_subflow` branch factored out: gate.test, then the trial view (`pageAfterTrial`), then `advice.told`, then the trial it ran.
  - `answeredTrial` moved here from builder-loop.
- `builder-auto-complete.ts` (new): `automationStudioSubflowBuilderAutoComplete(decide, ready)`.
  - When `request.canComplete` is true and `ready()` returns a receipt, it returns `{kind:"complete", result:{subflowKey,revision,digest}}` without calling the provider. The decision carries `automationStudioActivityDecisionReason.core(decision, automationStudioActivityFoldedReason({did, because}))`.
  - It does this at most once per revision and digest. If the completion check refuses it, the next decision goes back to the model instead of looping.
- `builder-loop.ts`:
  - Added a t811 header paragraph.
  - The submit tool gets one sentence about `then` (only where `gate.available`) and the `then` / `fromStepImpossible` properties.
  - Both the test branch and the folded test now go through one local `test()` helper, which updates `tried` and `lastTrial`.
  - The submit branch reads `then` first. A refused submission runs nothing. An accepted one tests through `test()` and adds `tested` and `testedWith`; its result carries the test's `effectApplied` and `targetsUnchanged`.
  - `discovery.decide` is wrapped by the auto-complete before `observe` wraps it. It is ready when `passed()` holds and `gate.completion(latest).ok`, so a yes Core could not confirm, a yes it held, or a standing repair completes nothing.
  - The file is now 502 lines.
- `index.ts`: exports the four new modules.
- New tests in `tests/`:
  - `then-fixture.ts`: a scripted fake-provider harness with a fake port. It counts decides and captures the decisions and answers.
  - `submit-tests-on-accept.test.ts`: 6 cases.
  - `builder-loop-auto-complete.test.ts`: 5 cases. They cover a plain test's yes completing with no further decide and a Core-written reason, an unconfirmed yes, a yes held for its rows, completion on the final decision, and the once-only / canComplete behaviour.
  - `submit-then-sequence.test.ts`: 3 cases. A clean submit with `"test_whole"` gets its verdict and completes after 1 decide. `"test_whole"` while a repair stands is refused. `then:{from:"second"}` runs. `fromStepImpossible` allows a whole test while a repair stands.

**Final submit answer shape** (≤10 lines):

```
{ ok, status:"draft", partial, subflowKey, revision, digest, changedPaths, verification, promotionAllowed:false,
  script|plan, scriptIs, note?, advice?, setAside?,
  next,                       // plain: as before + "Or test a revision in the call that submits it..."; folded: SUBMIT_THEN_WORDS.tested
  tested?,                    // folded only: the test's evidence exactly as core.test_subflow answers (pageAfterTrial incl.)
  testedWith?: {revision, digest, from?} }
```

**Decide wrapper:** `discovery.decide = autoComplete(input.loop.decide, ready)`. The order is input.loop.decide, then the auto-complete wrapper, then `observe`, so the observer sees the Core-made decision and its reason. The loop's `checkCompletion` still reads it.

## Commands run and observed results

- `L=...heavy-check.lock; until mkdir $L ...; FLUXIQ_TEST_GROUP=parallel npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/subflow-candidate; rmdir $L` (in the background) -> it never got the lock. Another lane's lock dated 23:28:34 was still there at 23:33:41, and the output file was empty. The run ends when I hand back, before its `mkdir`, so it cannot leave the lock behind.
- tsc, the two single-subflow/dispatch test directories, and `node scripts/structure-audit.mjs` were not run, for the same lock reason.

## Not verified

- None of my code has been compiled or run. Expect a few tsc fixes. The likely spots are the type of `Object.assign` on the port in `then-fixture.ts`, and the `discovery.decide` assignment.
- The existing tests have not been rerun. Tests that send a model completion after a yes to exercise the t601 mixed or receipt refusals will now see Core complete first, so they may fail. Those files are not mine; they need a supervisor decision.
- I have not checked whether a step written `step second:` gets the key `second` in the stub domain. If it does not, the `then:{from:"second"}` case needs W2's label mapping in `from-step-run.ts`, which had not landed when I looked. I kept that case as the brief asked.
- The structure audit has not been run: directory budget (4 new source files in `subflow-candidate`), and an export check on `submit-then.ts`, which exports a type plus a const.

## Open questions or contradictions found

- **Budget gap (llm/**, not mine).** The loop returns `exhausted("budget")` before calling decide when `remaining.decisionsLeft === 0`.
  - The cost and calls bounds never count to 0 ("never none"), so they let the Core-made completion through.
  - Tokens and duration can reach 0. If one does, the Core-made completion is never asked.
  - The same happens when the folded submit lands on `maxIterations`: the loop ends at the iteration cap before a further decide.
  - The final-decision check, wrap-up and purse do let it through: `complete` is handled before the final-decision tool check, and the purse only refuses on a provider call. A test covers the final-decision case.
  - Suggested fix in `evidence-loop.ts`: let a decide that needs no provider call run even at `decisionsLeft 0`.
- **Effect.** The submit tool is still `effect:"observe"`, so a folded test that moved the page does not bump the loop's epochs. This is mitigated: `tested.pageAfterTrial` shows the page, and a look asked again is re-run once (answer-check). Declaring the submit `mutate` would change repeat-guard and search-streak behaviour for every submit, so I did not.
- **Concurrent edits.** W2 is concurrently making `revision` and `digest` optional on `core.test_subflow`. The folded test always passes both, so it is unaffected.

Outcome: Partial
Changed: builder-loop.ts, index.ts, submit-then.ts, submit-then-words.ts, builder-test-call.ts, builder-auto-complete.ts, tests/then-fixture.ts, tests/submit-tests-on-accept.test.ts, tests/builder-loop-auto-complete.test.ts, tests/submit-then-sequence.test.ts (all under runtime/flow-bootstrap/subflow-candidate/)
Validation: `FLUXIQ_TEST_GROUP=parallel npx vitest run .../subflow-candidate` -> not run: waited on heavy-check.lock held by another lane; tsc and structure audit not run
Not verified: compile, all tests (new and existing), structure audit, whether label "second" resolves without W2
Report: C:/Users/osrs_/FluxStuff/fxwork/t811/!FluxIQWebExtension/docs/working/framework-heavy-lifting-plan/reports/t811/w1-fold.md
Notes: existing tests that complete after a yes may now auto-complete first; budget gap at decisionsLeft 0 (tokens/duration/iteration cap) is in llm/**.
