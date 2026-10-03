# t195-w39: a repeated press acts on each kept row (J1, R9)

## Outcome

Done. Both parts were done failing-first in the t195 trees, and nothing was committed.

## What changed and why

Core (`C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ`, R = `packages/fluxiq/src/programs/automation-studio/runtime`):

- `R/result-verification/build-test/summary.ts`: `targetWords` now receives the draft's steps. For a step with `routing.kind === "repeat"` it skips strings under the key `record` (new constant `ROW_KEY`). That key holds the template row's values, such as `element.context.record.text` = "Tom Becker1 mutual friend2w". It then appends `in each row step N keeps`, where N is the position of the `over` step. If that step cannot be found it appends `in each row its listing keeps`. A step that is not repeated keeps its record words.
- `R/llm/diagnosis-instructions.ts`: in the build-test instruction, after "runs says when a step runs: ... or repeated over another step's rows.", it adds: "A repeated step acts on each row that step keeps, finding its control again inside each row, never only on the row it was built on, so its target names no row: read it as acting on every kept row." A history comment line was added too.
- `R/llm/deepseek/tests/system-prompt-pins.json`: in `loop_verification` only, the old sentence was replaced with the new one by exact text substitution. The old text occurred exactly once in the pins.
- Tests:
  - `R/result-verification/build-test/tests/summary.test.ts` has a new describe, "the run-murwcaj0 shape". In it, a repeated Confirm has the target `["Confirm","in each row step 4 keeps"]` with no "Tom Becker", and an unrepeated Delete keeps its row words.
  - The run 36 test was updated: step 7 is repeated, so it no longer carries Jonas's card words, and its target is now `["Confirm","in each row step 4 keeps"]`.
  - `R/llm/tests/diagnosis-channel.test.ts` has a new describe that pins the new sentence in the `loop_verification` prompt.

Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQWebExtension`):

- `domain/src/runtime/llm-evidence/structure/packet.ts`: `AT_NOTE` adds: "at is that item's own element, so acting on it acts on that item only; to act on the rows a listing keeps, use the control inside one of the rows it keeps".
- `domain/src/runtime/llm-evidence/structure/tests/column-at.test.ts`: two `assert.match` lines on `atNote` pin the new wording.

## Commands run and observed results

Failing-first runs, after adding the tests and before changing the code:

- **Core.** Ran `npx vitest run --exclude ".tmp/**" <result-verification> <diagnosis-channel.test.ts> <deepseek/tests>`. Result: `Test Files 2 failed | 29 passed (31)`, `Tests 3 failed | 334 passed (337)`. The 3 failures were the run 36 Confirm words test, the new run-murwcaj0 test and the new judge-instruction test.
- **Downstream.** Ran `node .../scratchpad/run-domain-tests.mjs t195-w39 src/runtime/llm-evidence/structure/tests/column-at.test.ts`. Result: `not ok 5 - a column the first item lacks ...`, `# tests 5`, `# pass 4`, `# fail 1`.

Runs after the changes:

- **Core.** Same command. Result: `Test Files 31 passed (31)`, `Tests 337 passed (337)`. This includes the system-prompt pin tests with the re-pinned `loop_verification`.
- **Downstream.** Ran `node .../run-domain-tests.mjs t195-w39` on all five structure test files: badge-column, column-at, continues, detect and record. Result: `# tests 25`, `# pass 25`, `# fail 0`.

## Not verified

- I did not run a whole-package typecheck or any full suite, as the brief instructed. The `summary.ts` change uses only types and helpers already imported there.
- `AT_NOTE` is longer now. I did not check whether any request-size or byte pin outside `structure/tests` measures it.
- No live run was done.

## Open questions or contradictions found

- Core now names the domain's row key `record` as a literal (`ROW_KEY`). It is the same kind of key-name knowledge as `NOT_TARGET_WORDS`. Core has no declared seam for "the key a target's row travels under". If key names must stay domain-neutral, a domain declaration passed in through `build-judge.ts` would be the clean route, but that file is outside this brief.
- The Core tree contains uncommitted changes from other workers, including earlier edits to `diagnosis-channel.test.ts`, `RESULT_VERIFICATION_INSTRUCTION` and its pins. I left them untouched.
