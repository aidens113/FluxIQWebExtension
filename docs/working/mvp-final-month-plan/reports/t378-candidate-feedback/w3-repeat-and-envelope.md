# t378 w3: repeat note, refusal-run warning, unclosed-reply repair

## Brief

### Brief: t378-w3-repeat-and-envelope (worker)
- Repository: FluxIQ Core. Tree T = `C:/Users/osrs_/FluxStuff/fxwork/t378` (on `task/t378-candidate-feedback`). R = `T/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`.
- Task:
  1. (lane C C2) In candidate mode an identical `core.submit_candidate` resubmission is answered with the original refusal's issues, as that refusal gave them (each now gains `step`, `line` and sometimes `instead`: another worker is adding those fields to the refusal evidence now; carry whatever the stored refusal holds), and candidate advice: it was the same script, it was not checked again, change the lines the issues name, and sending it unchanged again ends the build with nothing tested. No repeat note in candidate mode mentions the draft (amend_draft, rerun, mark optional) or says the Flow so far is then tested and judged (`R/llm/repeat-guard/feedback.ts:16-26` and its other notes). Find how the loop knows candidate mode (for example its discovery-only flag), or key on the tool id. Lane C resent one refused script three times under the legacy note and the build ended.
  2. (lane D) `R/llm/decision-handlers/refusal-run.ts:56-58`: the refused-in-a-row warning promises a final test and judgement that candidate mode does not run; in candidate mode say what happens (the build ends with nothing tested).
  3. (lane C C3) `R/llm/deepseek/response-envelope.ts:116-129` repairs a surplus final `}`; also repair a reply missing only closing brackets at its end: on `finish_reason: stop` (never `length`), append the closers the unclosed structure needs (outside strings), accept only if the result then parses and validates as usual, and record the repair as the surplus case is recorded. Lane C lost three decisions to replies one `}` short.
  4. Trace only, no fix required: in lane B (`C:/Users/osrs_/FluxStuff/lab-runs/2026-10-08/run-mv0fu9pb-57454dc4/steps/`), the identical resubmission at 0060 ran instead of being refused as a repeat, while 0062 onward were refused. Say why in the report.
- Required reads: those files and `R/llm/repeat-guard/outcomes.ts`; lane C debug (read-only) `C:/Users/osrs_/FluxStuff/fxwork/t274/!FluxIQWebExtension/docs/working/language-driven-flow-loop-plan/debugs/run-mv0fuotv-805294d7.md` (C2, C3); the live unclosed replies under `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-08/run-mv0fuotv-805294d7/steps/0017-decide`, `0025-decide`, `0033-decide` (copy one as a fixture).
- Owns: `R/llm/repeat-guard/**`, `R/llm/decision-handlers/refused-repeat.ts`, `R/llm/decision-handlers/refusal-run.ts`, `R/llm/deepseek/response-envelope.ts`, new files beside them, their barrels and `tests/`.
- Must not touch: every other file (another worker owns `R/flow-bootstrap/candidate/**` and `R/llm/harness-options/bootstrap-completion.ts`; read them, do not edit), any other tree, lab slots or processes.
- Concurrency: other workers edit other Core files in T now. An error only in a file you do not own is theirs: record it, do not fix it. Core rules: one exported thing per file, a barrel per directory, tests in `tests/` beside the subject.
- Definition of done: fail-first tests beside each change: the identical-resubmission note carries the stored issues and no legacy words; candidate refusal-run wording; a reply missing its final `}` parses after repair; a `length` reply is not repaired. `npx vitest run <paths>` from `T/!FluxIQ` passes; `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` clean for your files. Never commit; no `pnpm build`; no Lab run or provider call.
- Report to: `T/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/w3-repeat-and-envelope.md` (paste this brief at its top; protocol report format; return at most 12 lines).

## Outcome

Done. All four items finished; item 4 was a trace only.

## What changed and why

All paths below are under R = `T/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`.

1. **Identical resubmission in candidate mode (C2).**
   - `llm/repeat-guard/outcomes.ts`: `AutomationStudioLlmEvidenceRepeatedOutcome` gains `issues?: JsonValue[]`. When a refused call is recorded, the guard parses the answer it already receives (`answer: JSON.stringify(value)` from the loop) and keeps the refusal's `diagnostics.issues`, or its own `issues`, exactly as given. The new `step`, `line` and `instead` fields come along automatically. The header comment now has a paragraph about this.
   - New `llm/repeat-guard/candidate-feedback.ts` (one export, `automationStudioLlmEvidenceCandidateRepeatInstruction`) holds the candidate-mode wording:
     - a refused submission: same script, not checked again, the issues listed under `issues`, change the lines they name;
     - an accepted submission sent again;
     - a plain call, a look, and a handle that was never shown.
     None of these mentions the draft, a rerun, marking a step optional, or "tested and judged". Each ends by saying what sending it unchanged again does. At `inARow >= max-1` it says "Sending it unchanged again ends this build with nothing tested." Earlier, it says the repeat is refused the same way and that 3 refused in a row end the build with nothing tested.
   - `llm/repeat-guard/feedback.ts`: `automationStudioLlmEvidenceRepeatRefusalNote` takes an optional `candidate`. When it is set, the note uses the candidate instruction and, for a refused submission, adds `issues` to the note. Legacy notes are unchanged. The barrel `index.ts` exports the new file.
   - `llm/decision-handlers/refused-repeat.ts` passes `candidate: context.input.discoveryOnly === true`. This is how candidate mode is known: `flow-bootstrap/candidate/authoring-loop.ts:49` sets `discoveryOnly: true`. The header comment is updated.
2. **Refusal-run warning (lane D).** `llm/decision-handlers/refusal-run.ts`: when `input.discoveryOnly === true`, the warning reads "One more decision refused for it ends this build with nothing tested." It then advises correcting the lines a refused submission names and resubmitting, or looking at the page. It no longer mentions a final test and judgement, or "run what the Flow still lacks". The legacy text is byte-identical.
3. **Unclosed reply (C3).**
   - New `llm/deepseek/unclosed-content.ts` (`automationStudioDeepSeekClosedContent`) returns the content with the closers of its still-open brackets appended, innermost first. It returns `undefined` in four cases:
     - the content does not start with `{`;
     - it ends inside a string;
     - a closer closes the wrong kind of bracket;
     - the root closes before the end.
   - `llm/deepseek/response-envelope.ts` (`parseDeepSeekJsonContent`): when no complete top-level object exists, it tries the closed text. It accepts the result only if `JSON.parse` succeeds, and the parsed value then goes through the usual `parseDeepSeekStructuredResponse` validation. Otherwise it is refused with the same `content_unclosed` account as before. This path is reached only on `stop`, because `length` is refused earlier at lines 33-38.
   - "Recorded as the surplus case is": the surplus repair records nothing on the result. It is silent, and the raw reply stays in the step log through `step?.reply(bytes)`. The new repair does exactly the same, and the doc comment says so. If the supervisor wants an explicit repair marker, that is a new field on a harness type I do not own.
   - The barrel comment in `deepseek/index.ts` names the new module. It is not exported, because it is internal, like `json-record.ts`.
4. **Tests.**
   - New `llm/repeat-guard/tests/candidate-feedback.test.ts` (5): stored issues, note issues, no legacy words, wording that depends on `inARow`, other candidate notes, legacy unchanged.
   - New `llm/decision-handlers/tests/candidate-repeat-told.test.ts` (2): a real loop with `discoveryOnly: true`, covering the identical resubmission note and the refusal-run warning.
   - New `llm/deepseek/tests/unclosed-reply.test.ts` (6) plus fixture `llm/deepseek/tests/unclosed-reply-0017.json`. The fixture is the live 0017 content and usage. 0025 and 0033 have the same shape: each ends `}}}` and parses with one `}` added. The tests cover: the live reply is read as `core.run_node` extract-list; a `length` reply gets `llm.provider_output_truncated`; a reply cut inside a string or with miscounted brackets is still refused; a closed reply that still does not parse is refused; a closed reply of the wrong shape is refused as `provider_output_invalid`.
   - Edited `llm/deepseek/tests/response-envelope.test.ts`: two rows used `DECISION.slice(0, -3)` as their example of "never closes", and that reply is now repaired. They now cut the reply inside a string, so the `content_unclosed` case and the paid-usage case are still exercised.

## Commands run and observed results

All commands were run from `T/!FluxIQ`.

- **Fail-first.** I temporarily replaced my five edited source files with their `HEAD` versions (`git show HEAD:...`), then restored them from scratch copies. Command: `npx vitest run .../repeat-guard/tests/candidate-feedback.test.ts .../decision-handlers/tests/candidate-repeat-told.test.ts .../deepseek/tests/unclosed-reply.test.ts`. Result: `Test Files 3 failed (3)`, `Tests 8 failed | 5 passed (13)`.
  - Every repeat-note, refusal-run and live-repair test failed.
  - The tests that passed check behaviour that was already correct and must not regress: no repair on `length`, no repair inside a string or of miscounted brackets, and the legacy note unchanged.
- **After restoring.** Command: `npx vitest run llm/repeat-guard/tests llm/decision-handlers/tests llm/deepseek/tests/unclosed-reply.test.ts llm/deepseek/tests/response-envelope.test.ts llm/tests/deepseek-json-content.test.ts llm/evidence-loop/tests/repeat-guard.test.ts flow-bootstrap/candidate/tests`. Result: `Test Files 27 passed (27)`, `Tests 172 passed (172)`.
- **Whole `deepseek/tests` folder.** An earlier run of the whole folder showed `system-prompt.test.ts` with 4 failures: the pins for `loop_verification` and `loop_verification_build_test` are not byte-identical. I did not change `system-prompt.ts`. `git status` shows `llm/diagnosis-instructions.ts` modified by another worker, which is the likely cause. That file is not mine, so I recorded the failure and did not fix it.
- **Typecheck.** `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` printed nothing (clean).

## Item 4: why lane B 0060 ran and 0062 was refused

- The repeat guard keys a call on its whole canonical input (`outcomes.ts`, `key()`).
- 0058 (`submit-flow-1`) sent `{summary, flow}`. 0060 (`submit-flow-2`) sent the same `flow` and left out `summary`. A key-by-key comparison of the two `call.json` inputs found only `summary` different. So 0060 had a new key and ran, and was refused by the check with the same code, `flow_bootstrap.evidence_completion_parameters_unresolved`.
- 0062 sent exactly 0060's input, `{flow}` only, so it matched 0060's failed key (`sameAsCall: "submit-flow-2"`) and was refused unrun. The same happened from 0064 on.
- A possible follow-up, not done: key `core.submit_candidate` on `flow`/`plan` only, so that a changed `summary` alone is still a repeat.

## Not verified

- No live run or provider call.
- The full `pnpm check`, test and build suites were not run.
- The structure audit was not run.
- The real refusal evidence with the other worker's `step`/`line`/`instead` fields was not exercised. My tests use issues shaped that way, and the code carries whatever `diagnostics.issues` holds.
- That a candidate-mode stall really ends the build untested comes from the brief and the lane C debug. I did not trace it through the bootstrap code.

## Open questions or contradictions found

- The surplus `}` repair is not recorded anywhere except the raw step log, so "record it as the surplus case is recorded" means no record. An explicit marker needs a harness type change outside my files.
- The `system-prompt.test.ts` pin failures come from another worker's `diagnosis-instructions.ts` edit, or another worker's change in any case. They are not mine.
- In candidate mode, an accepted submission that is sent again identically is also refused, as `changed_nothing`. The guard already did this; it now gets a candidate note that tells the model to test the revision or complete with it.
