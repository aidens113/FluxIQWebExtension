# Lane S-D3 (t728): domain instructions keep only web wording; card screen uses Core's helper

Worker report. Tree: `C:/Users/osrs_/FluxStuff/fxwork/t728/!FluxIQWebExtension`. Nothing committed.
Core was read only and was not rebuilt.

## Outcome

Done. All named checks pass for my files. The structure audit exits with one violation, in a file
another worker owns (see below).

## What changed and why

- `domain/src/runtime/llm-evidence/system-instructions/instructions.ts`
  - Deleted exactly the sentences listed in `lane-s-d-prompt-screen.md`:
    - the recordings line;
    - three sentences from Lists: the loop rule, item type by evidence, and bound values;
    - the clause "-- in a draft by amend_draft repeat, in a written Flow by its repeat lines" (the
      paging sentence now ends at "each row kept once.");
    - the Limits sentence about what a person could do and secrets;
    - the efficiency line.
  - Kept the web-only text: the opening sentence, page view, finding things, popups, choices,
    Next-page paging, explore-one-page, and CAPTCHA. Lists now starts "Lists. Every page of a list
    is a loop the Flow states: ...". Limits is now only the CAPTCHA sentence.
  - `version` is now `web-12`, with a web-12 history comment.
  - **Final text length: 2,547 characters** (the test bound is 3,600).
- `system-instructions/tests/instructions.test.ts`
  - New test: the moved sentences are absent here, because Core says them now. It checks the
    recordings text, "recording", the loop rule, "never act on every item", item type, `{"$input"}`,
    amend_draft repeat, the written-Flow repeat lines, person limits, money/delete/send,
    password/secret, and efficiency/cost ceiling.
  - The fixture-teaching assertion is now a separate test.
  - The version is pinned to `web-12`.
  - The paging test now expects Lists to start with "Every page of a list is a loop".
  - The web-6 test now checks only explore-one-page.
  - The person-limits test is now a CAPTCHA-only test.
  - Removed the loop, category-type and efficiency tests.
  - The control-character and length-bound test is unchanged.
- `domain/src/runtime/llm-evidence/withheld.ts`
  - Removed the local `DIGIT_RUN`, `CARD_GROUPING`, `cardNumber` and `luhn`.
  - `screenedText` now calls `automationStudioWithoutCardNumbers(value, WEB_LLM_WITHHELD_TEXT)` from
    `fluxiq/automation-studio`, and that in-place pass still runs before
    `screenAutomationStudioLlmEvidence`. This order matters: Core's screen now flags card runs, so
    without the pass first a card would cost the whole string. The header comment says this.
  - The tests are unchanged and pass. The "Card X on file." assertion is what tests the order.
- `domain/src/runtime/llm-evidence/tool-rejection.ts`: in `WEB_LLM_TOOL_REJECTION_REASONS` (`as const`),
  the literal `"answered_the_same_again"` is now `AUTOMATION_STUDIO_REPEATED_ANSWER_REASON`, imported
  from `fluxiq/automation-studio`. Core declares it as a literal type, so the tuple type is unchanged.

## Commands run and observed results

All `test-domain.mjs` runs were from `domain/`.

- Grep for `web-11` and for the deleted sentences under `domain/src`, `packages`,
  `apps/extension/src` and `scripts`: the only hit is the history comment in `instructions.ts`. No
  other test pins the text.
- `DOMAIN_TEST_BUILD_LABEL=lane-s-d3 node scripts/test-domain.mjs system-instructions/tests/instructions llm-evidence/tests/withheld llm-evidence/tests/tool-rejection-detail llm-evidence/tests/vocabulary llm-evidence/tests/sanitize llm-evidence/tests/page-refusal`
  -> tests 64, pass 64, fail 0. The instructions file alone: 15/15 pass.
- The same command with every other test file that has a `Luhn|4111` fixture (facts/evaluate,
  left-out-together, press-changes, refusal-notice, rejected-rows, replay-read-account,
  extraction/slot, dialog-identity, structure/detect, whole-page, adapter-text-sighting,
  host-runtime) -> tests 126, pass 126, fail 0.
- `pnpm --filter @fluxiq-web-extension/domain check` -> exit 0. core-build reported "FluxIQ Core's
  build ... is current with its source"; then both tsc passes ran.
- `node scripts/structure-audit.mjs` -> "1 violation(s) across 1 rule(s)":
  - `FAIL [swallowed-failure] apps/extension/src/background/connection.ts: 2 failures are silently
    dropped, at lines 124, 550` (baseline 1).
  - That file is modified in this tree by another worker; it is not mine.
  - The only output on my paths is an advisory: `tool-rejection.ts: 779 lines` is past 400. That
    file was already that long.

## Not verified

- No live run, so how the model behaves with the shorter text is not checked.
- Whole package suites were not run, per the brief.
- `repeated-refusal.ts` still uses its own literal: it was not mine to change.

## Open questions or contradictions found

- The structure audit stays red until the owner of `apps/extension/src/background/connection.ts`
  fixes its new swallowed catch at line 124 or 550.
