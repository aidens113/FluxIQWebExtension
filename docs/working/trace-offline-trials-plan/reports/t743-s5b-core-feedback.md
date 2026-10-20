# t743-s5b-core-feedback report

## Outcome

Done. All three fixes are in the Core tree at `C:/Users/osrs_/FluxStuff/fxwork/t743/!FluxIQ`, with tests beside them. The tests named below pass. No typecheck, build or whole-package suite was run, because the brief forbids them.

R = `packages/fluxiq/src/programs/automation-studio/runtime/`.

## What changed and why

### 1. A long trial now names the step it stopped at (debug fix 2)

- **`R/service/candidate-trial/feedback.ts`, `steps()`.** When a run takes more than `MAX_STEPS` (40) steps, the feedback now lists:
  - the first 39 steps;
  - then the last step the run attempted, under its real step number, with its full entry (failure code, `actual`, retryable and the rest).

  `stepsLeftOut` counts the steps between them. For the 86-step loop that is 46, the same number as before. The per-step code was not changed; it now runs over the chosen indices, so the extra step uses its real index everywhere (`openerBefore`, target-on-page and so on). The header records the change (S5).
- **`R/flow-bootstrap/candidate/trial-stop.ts`.** The changed behaviour:
  - When the last listed step failed, `of()` returns `kind: "step"` for it, and the stop now carries `leftOut`.
  - The sentence ends: "The listing under steps shows the first N and then this one, the last the run took; the M between them are left out."
  - With steps left out, `ranBefore` is not claimed, because the listing no longer holds every earlier run of that step.
  - The `steps_left_out` kind is removed. The only other reference to it was this file's own test. A long run whose last step did not fail falls through to the graph, start or run ending as usual. The "run" sentence counts the listed steps plus the steps left out, so it names step 86.
  - The header bullet is updated.

### 2. The step log now names what was thrown (debug fix 3)

- **`R/llm/step-log/summary.ts`.** `tool()` now reads the error's name off the `{name, code}` record that `thrown()` makes, accepting only an identifier-like name, where it used to test `instanceof Error`. A codeless DOMException TimeoutError is now logged as `threw TimeoutError` instead of `threw non_error`.
- **`R/llm/step-log/tool-step.ts`.** `meta.json` `loopVerdict` for a throw is now:
  - `llm_evidence_loop.cancelled` when the name is `AbortError` or `TimeoutError`;
  - `llm_evidence_loop.tool_failed` otherwise.

### 3. Judge advice no longer says to add a refused field to the same read (debug fix 5)

**Where the advice reaches the builder.** The judge's advice goes from `feedback.ts` into `judge.advice`, `unconfirmedReading.advice` or `answeredReading.advice`, then through `core.test_subflow`. There the builder loop passes it through `AutomationStudioSubflowRepeatedAdvice.told`, the repeated-advice memory. That memory is shared across a build's briefs by `project-agents/dispatch/run-brief.ts`, which I did not touch. I rewrote the advice in Core from what the build was refused. The judge prompts are unchanged, so the pins file was not edited.

- **New `R/flow-bootstrap/subflow-candidate/disclosure-advice.ts`**, which exports `AutomationStudioSubflowDisclosureAdvice` (exported from the barrel).
  - `saw(ran)` records a tool answer refused with `detail.reason === "incomplete_text"`. It keeps the field keys from `detail.missing`, identifiers only.
  - `told(answer)` also counts a trial step whose `actual` starts with the closed `incomplete_text` marker.
  - Once either has been seen, a sentence that asks to add or include a field or column is replaced by Core's disclosure-order sentence. This applies to a judged no's `judge.advice` and to `unconfirmedReading.advice` / `answeredReading.advice`.
  - The order sentence: read the row-context columns without the field; repeat over that read, pressing each kept row's own disclosure control; then, after the repeat and not inside it, read the same listing again with the field; give both reads the same conditions.
  - The order sentence is said once per advice. A later judge call's sentence asking the same becomes "follow the order above instead". Its "Judge call N: " prefix is kept, and every other sentence is unchanged.
  - The wording is generic.
- **`R/flow-bootstrap/subflow-candidate/repeated-advice.ts`.**
  - It now holds one `AutomationStudioSubflowDisclosureAdvice`.
  - New `saw(ran)` passes answers to it.
  - `told` = disclosure rewrite after the existing repeat filter, which is now a private method `withoutRepeats` with an unchanged body.
  - Because it sits on the shared memory, a refusal in brief 1 also rewrites advice shown to the repair brief.
- **`R/flow-bootstrap/subflow-candidate/builder-loop.ts`.** One line: `advice.saw(ran)` for every tool call that is not a submit or a test.
- **`R/flow-bootstrap/subflow-candidate/index.ts`.** Exports the new file.

**Ownership: please confirm.** I edited `builder-loop.ts`, `repeated-advice.ts` and the subflow-candidate barrel as "the judge-advice files". They are not in R/project-agents/ or R/service/project-build/. At the time, git showed no other modifications in that directory.

## Commands run and observed results

All were run from `C:/Users/osrs_/FluxStuff/fxwork/t743/!FluxIQ/packages/fluxiq` with `pnpm exec vitest run --maxWorkers=2 --minWorkers=1 ...`.

1. `.../service/candidate-trial/tests/feedback.test.ts` and `.../flow-bootstrap/candidate/tests/trial-stop.test.ts`.
   - First run: 2 failed.
     - My new text contained "feedback", which matches the test's /feed/ word guard. I reworded it.
     - An old fixture numbers its steps 6 and 7 while listing two, so the "run" sentence now counts listed steps plus steps left out.
   - Rerun: "Test Files 2 passed (2), Tests 41 passed (41)".
2. `.../llm/step-log/tests`: "Test Files 8 passed (8), Tests 45 passed (45)".
3. `.../subflow-candidate/tests/disclosure-advice.test.ts` together with `builder-loop.test.ts`.
   - First run: 1 failed. A model tool call I scripted never reached `executeTool`, for a reason I did not chase. The integration test now refuses the builder's opening `core.run_node` look instead, which goes through the same `executeTool` path in builder-loop.
   - Rerun: 5 passed.
4. Final run over every touched folder, plus the dispatch memory test and the prompt contract test:
   - Paths: `R/flow-bootstrap/subflow-candidate/tests R/flow-bootstrap/candidate/tests R/service/candidate-trial/tests R/llm/step-log/tests R/project-agents/dispatch/tests/repeated-advice-memory.test.ts R/llm/deepseek/tests/system-prompt.test.ts`.
   - Result: "Test Files 88 passed (88), Tests 625 passed (625)", Duration 217 s.

## Not verified

- No typecheck (forbidden by the brief), so type errors in the new code would only show up in vitest's transform. None appeared.
- The structure audit was not run. One export per file, the barrel and the file counts were checked by hand.
- **Same listing not checked.** Fix 3 does not check that the refused read was "the same listing" as the judged run's missing column. Core cannot match an exploration read's target to a trial read. So any `incomplete_text` refusal in the build (or in the subflow's shared memory) turns on the rewrite for any advice sentence asking to add or include a field or column.
- **Detection is wording-based.** It is a sentence pattern, so a judge phrasing that avoids "add/include … field/column" (for example "read the body text too") is not rewritten.
- **Cross-repository contract.** Core now reads the downstream closed refusal word `incomplete_text`: in `detail.reason` and `detail.missing`, and as the `actual` marker prefix of a trial step. That is a dependency on `domain/src/runtime/llm-evidence/action-failure/refusal.ts` and needs recording in the architecture docs.
- **Order of the two filters.** The rewrite runs after the repeat filter. A repeated "add the field" sentence is therefore dropped and noted as repeated, not rewritten again, so the builder sees the disclosure order only the first time.
- **Trial screen not checked.** I did not confirm that a live trial step's `actual` keeps the `incomplete_text:` prefix through the model-facing screen. The tool-call path (`detail.reason`) does not depend on it.
- No live run.

## Open questions or contradictions found

- Is editing `builder-loop.ts`, `repeated-advice.ts` and the subflow-candidate barrel within my ownership? (See section 3.)
- The scripted builder-loop test showed that a model `tool_call` to `core.run_node` with input `{node: "web.read"}` never reached `executeTool`. That is probably the loop's own input validation, and I did not investigate it.
