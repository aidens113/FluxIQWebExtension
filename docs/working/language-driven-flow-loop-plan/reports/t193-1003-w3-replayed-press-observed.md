# t193-1003-w3: a replayed press's answer reaches the build-test judge

## Outcome

Done. A changing step that the test ran again now carries `observed` when its answer says what it changed or what the page answered (`changed` or `notice`). The answer's top-level `ok` and `said` are left out, and so is its `code` when that code equals one of the outcome's result codes. All tree paths below are relative to `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime` (R).

## What changed and why

- `R/result-verification/build-test/observation.ts`
  - The reader type takes an optional third argument, `restating?: ReadonlySet<string>` (the outcome's codes).
  - When `restating` is given, each answer has its view keys removed. The answer is then kept only if it is an object that carries `changed` or `notice`, and it loses `ok`, `said` and any `code` found in the set.
  - An answer left with nothing is not sent. If no answers are left, the reader returns no value.
  - After that the reader works as before: read-rows, bookkeeping, denied keys, locators, secret screening, and `as step N`.
  - The header comment now explains this.
- `R/result-verification/build-test/summary.ts`
  - For a `mutate` step that was not checked and was run again (status `replayed`, or it has `passes`), the new `replayedCodes(outcome)` builds the code set.
  - The set holds the outcome's own code and each pass's code. A missing code falls back to `core.replay.<status>`, the same fallback `flow-draft/dry-run.ts` uses.
  - Such a step is now observed, through both its pass lines and its own observation, with that set passed on.
  - The header's `observed` bullet now covers this case.
- `R/llm/diagnosis-instructions.ts` (build-test instruction):
  - Old: "observed (what the test saw: the rows a read returned, or a check's answer)."
  - New: "observed (what the test saw: the rows a read returned, a check's answer, or, for a changing step run again, what it changed or what the page answered -- a replayed press's observed.changed is what the test saw it change)."
- `R/llm/deepseek/tests/system-prompt-pins.json`: the same sentence, updated in the `loop_verification_build_test` pin. The pin test fixes this exact text, so the pin had to change with it.
- `R/result-verification/build-test/tests/summary.test.ts`: a new describe block for the run-musp4h2f shape (6 tests).
  - A replayed `+` whose answer has `changed` gets `observed: { changed: [...] }`.
  - An answer with `notice` gets `{ notice }`.
  - An answer with only ok/code/said gets nothing.
  - A `code` the outcome did not give is kept beside `changed`.
  - An answer with neither `changed` nor `notice` (for example status or control fields) gets nothing.
  - A read and a checked step are unchanged.
  - Written first. Before the fix, 3 of them failed as expected; the "nothing" cases passed already.

**Design choice that departs from the literal brief.** My first version sent everything left after removing ok/code/said. On the run-36 fixture in `request-size.test.ts`, the request grew from 11,158 to 13,438 characters (the bound is 14,000). Replayed clicks 1-5 each sent their whole old-format tool result: location, read, validation and so on. That also broke the test that expects `location` and `url` to read `as step 6`. So I now send an answer only when it carries `changed` or `notice`, the domain's account of what the press did, which is what the brief's first sentence asks for. With that rule the run-36 request is unchanged, and `request-size.test.ts` passes without edits.

## Commands run and observed results

- Before the fix: `npx vitest run .../build-test/tests/summary.test.ts` -> "Tests 3 failed | 18 passed (21)". The failures were the changed, notice and code cases.
- First (unrestricted) version: `npx vitest run src/programs/automation-studio/runtime/result-verification` -> 1 failed: `request-size.test.ts` "names text an earlier step already sent...". It expected `location: "as step 6"` and received `"as step 4"`. A size probe I added for a moment and then reverted gave LEAN 13438.
- Final: `npx vitest run src/programs/automation-studio/runtime/result-verification src/programs/automation-studio/runtime/llm/tests src/programs/automation-studio/runtime/llm/deepseek/tests` (from packages/fluxiq) -> "Test Files 62 passed (62) / Tests 775 passed (775)".
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t193 w3 tsc" npx tsc --noEmit -p tsconfig.json` (from packages/fluxiq) -> "[heavy] t193 w3 tsc holds b1", no diagnostics, exit 0.

## Not verified

- No live run. I did not check the live judge's answer on a replayed `+`.
- I did not run the structure audit.
- The `run-musp4h2f` outcome itself was not read. I assume its outcome code was `core.replay.replayed` or absent; either way it is removed, because of the fallback.

## Open questions or contradictions found

- `R/result-verification/contracts.ts` l.328 has a doc comment on `observed`: "the rows a read returned, or a check's answer". It is now incomplete, but the file was not mine to edit.
- `run-36-test.json` holds old-format whole tool results for replayed clicks. If a domain ever answers a replay with `changed` or `notice` inside a whole tool result, the rest of that result is sent too, after the view keys and bookkeeping are removed.
- `git diff --stat` in the Core tree also shows edits by other workers in `flow-bootstrap/**` and `flow-draft/verify-only.ts`. I did not touch them.
