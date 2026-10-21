# t753-g-guard report

## Outcome

Done. The guard module, its barrel export, its unit tests and two sweep tests are written. The sweeps fail as intended: 6 producer scenarios fault (5 in the activity sweep, 1 in the ui sweep). A seventh scenario (the generated class name) faulted on my first run and passes on the second, because another worker changed `call-context.ts` and `human-label.ts` in the meantime.

## What changed and why

All paths below are under `C:/Users/osrs_/FluxStuff/fxwork/t753/!FluxIQ/packages/fluxiq/src/`.

- `ui/person-facing/` (new). Each file exports one thing:
  - `index.ts` is the barrel. It exports only `personFacingTextFaults`.
  - `text-faults.ts` holds `personFacingTextFaults(text): readonly string[]`, which combines the four checks below.
  - `internal-terms.ts` matches whole words in any case: subflow(s), router(s), candidate(s), brief(s), harness(es), trial(s).
  - `code-identifiers.ts` finds three kinds of code name:
    - Dotted names with an underscore in a segment, or with 3 or more segments. A segment of 2-3 letters at the end means a host name, which is exempt (`example.com`, `www.example.co.uk`).
    - snake_case.
    - camelCase: at least 2 lowercase letters, then humps of an uppercase letter followed by lowercase ones. So `iPhone`, `eBay` and `macOS` pass.
  - `generated-names.ts` finds two shapes of generated name:
    - A lowercase prefix of 1-8 letters, then `-` or `_`, then a tail of at least 3 characters that is all digits, mixes letters and digits, or has a camel hump (`css-0732x7m`, `jsx-1234`, `sc-AxjAm`).
    - A leading `_` with a digit in the tail (`_a1b2c3`).
  - `stutter.ts` finds two kinds of repetition:
    - One part of a joined display said again whole. Parts are split on `|`, `·`, `:`, `—` and sentence-ending `.`, and a part must be 2 or more words.
    - The longest run of at least 3 words, with at least 2 of them not filler words, that is said twice without overlapping.
- `ui/index.ts`: added one line, `export * from "./person-facing/index.ts";`.
- `ui/person-facing/tests/text-faults.test.ts`: 29 tests.
  - All 7 round-5 strings fault, and each names its token.
  - 18 ordinary sentences pass. They include "Clicking “Clip 21.4K2”", "Paying with “Visa 4417”", "Opening “example.com”", `iPhone`/`eBay`, "e-mail" and "Wi-Fi".
  - Each fault class has its own test.
- Sweep 1: `programs/automation-studio/runtime/activity/tests/person-facing-sweep.test.ts`. It drives the real activity producers and reads them back through the real `activityActionOf` and `ActivityPacer`.
- Sweep 2: `ui/tests/person-facing-sweep.test.ts`. It feeds the pacer the round-5 project-build ending, built as hand-made events. Code in `ui` cannot import `programs`, and the code that writes that row (`service/project-build`) is not on the brief's producer list.

### Where I departed from the brief

- **Stutter tuning.** The brief asks for "a phrase of at least four words appearing twice". The round-5 positive has no repeated 4-word phrase: its repeats are "build failed" (2 words) and "could not finish" (3 words). I used two rules instead: the headline/part echo, and a repeated run of 3 or more words with at least 2 non-filler words. Requiring the 2 non-filler words keeps "one of the … one of the" from faulting.
- **Plan card input.** `plan-input.ts` is not exported from the supervisor barrel, and the structure audit fails a test that imports past a barrel. So the plan-card sweep does not call it. It reproduces what plan-input's `compile` adds:
  - a `main` subflow named `GUIDANCE.router.name`, using the purpose `GUIDANCE.router.purpose` (both from the barrel),
  - on the existing card fixture (`project-agents/tests/fixtures.ts`, a recipe archive).

## Commands run and observed results

All run from `packages/fluxiq` unless noted.

1. `pnpm exec vitest run src/ui/person-facing src/ui/tests/person-facing-sweep.test.ts src/programs/automation-studio/runtime/activity/tests/person-facing-sweep.test.ts`
   - `text-faults.test.ts`: 29 passed.
   - Overall: `Test Files 2 failed | 1 passed (3)`, `Tests 6 failed | 31 passed (37)`.
2. `pnpm exec tsc --noEmit -p .` printed 15 syntax errors (TS1002/TS1005/…), all in `runtime/activity/tests/call-context.test.ts`. That file is another worker's in-flight edit. Because a syntax error stops the full check, I also ran a scratch tsconfig (since deleted) that extends `tsconfig.json` and lists only my 5 files: exit 0, no output.
3. From the Core root, `node scripts/structure-audit.mjs`:
   - My first run flagged 4 problems in my files: `as never` casts and imports that reached past a barrel in sweep 1, a barrel bypass in sweep 2, and statement packing in `stutter.ts`. All 4 are fixed.
   - Final run: `structure-audit: 1 violation(s) across 1 rule(s)`. The one left is `[as-never] runtime/activity/tests/refused-call.test.ts: 10 casts … Baseline for this entry is 8`. That file is another worker's.

### The sweep's failing list (verbatim from the final run)

Activity sweep (`runtime/activity/tests/person-facing-sweep.test.ts`):

- **wording/tool-call.ts** (`automationStudioActivityToolCall`):
  - `core.submit_subflow`: title and label "Using “Submit subflow”" → `internal term "subflow"`
  - `core.test_subflow`: title and label "Using “Test subflow”" → `internal term "subflow"`
- **observer + ui/activity-action/action-of.ts** (the emitted rows and their cards):
  - label "Using “Submit subflow”", title "Using “Submit subflow”", card "Action · Submit subflow", label "Using “Submit subflow” — done" → `internal term "subflow"`
  - label "Using “Test subflow”", title "Using “Test subflow”", card "Action · Test subflow", label "Using “Test subflow” — done" → `internal term "subflow"`
- **decision-answer/refused-call.ts** (a refused repeat of `core.submit_subflow`), each → `internal term "subflow"`:
  - label "Not done: using “Submit subflow” — it was already tried exactly this way and changed nothing"
  - title "Using “Submit subflow”"
  - card "Action · Submit subflow"
- **project/receipt-card.ts**:
  - label and title "Subflow trial passed: List soups" → `internal term "subflow"`, `internal term "trial"`
  - label and title "Whole-Flow trial could not be confirmed" → `internal term "trial"`
- **project/plan-card.ts** (with the router subflow Core adds), each → `internal term "subflows"`:
  - title "Plan: 2 parts in 3 subflows"
  - text "Main: Runs each of the other subflows in turn, passing each value on by name.. List soups: Read the newest soups. Save recipe: save the first one to my cookbook"
  - plan-card purpose "Runs each of the other subflows in turn, passing each value on by name."
- **wording/action.ts + call-context.ts** (a control the page view printed only as `class="css-0732x7m"`):
  - **First run** (worktree had no other edits yet), each → `generated name "css-0732x7m"`:
    - action title/label "Reading the details of “css-0732x7m”" and "Clicking “css-0732x7m”"
    - emitted label "Reading the details of “css-0732x7m” — done"
    - card "Look · the \"css-0732x7m\" label"
  - **Final run:** passes. This follows another worker's in-flight edits to `call-context.ts` and `human-label.ts`.
- **build.ts + pacer** (a generic throw, and a `not_finished` ending): passes. These failure paths in `build.ts` neither stutter nor fault.

ui sweep (`ui/tests/person-facing-sweep.test.ts`):

- **activity-status pacer**, project build ended "Build failed: FluxIQ could not finish the Flow" with the reason "I could not finish this.":
  - shown "Build failed | Build failed: FluxIQ could not finish the Flow. I could not finish this." → `repeated phrase "build failed"`, `repeated phrase "could not finish"`

## Not verified

- I did not run either sweep against a clean HEAD. The worktree was changing under me: the other workers' 25 modified and 14 new files were not there when I started. The css result moved between my runs for that reason.
- The ui sweep's events are hand-built in the shape of round 5. The project-build code that writes them (`service/project-build`, `project-build-ending`) was not driven, because it is not on my list and other workers are editing it.
- The pacer text is `${headline} | ${detail}`. That is how the round-5 string reads, but I did not confirm in code that the overlay joins the two this way.
- Producers not swept: `conversations/commands/execute.ts` ("Saved candidate draft. …" is a round-5 positive, but the brief did not list that file and another worker owns it), the brief and return cards, and `left-told`/`run-ending` wording.
- No full suites were run and Core was not rebuilt, as the brief says.

## Open questions or contradictions found

1. The brief's "at least four words" rule cannot catch its own round-5 stutter positive (see "Where I departed from the brief"). Confirm the 3-word rule with its 2-non-filler-word condition is acceptable.
2. The plan card's `text` joins purposes that already end in "." with ". ", which gives "by name.. List soups". The guard does not check for doubled punctuation, but it is a visible defect in `project/plan-card.ts`.
3. Known gaps in the guard:
   - "brief" and "trial" fault even as ordinary English ("a brief pause"), as specified.
   - A lowercase word plus 3 or more digits behind a hyphen ("summer-2024") would read as a generated name.
4. `plan-input.ts` is not exported from the supervisor barrel. A test that wants the real router-adding path has to go through the plan tool, or the barrel needs that export.
