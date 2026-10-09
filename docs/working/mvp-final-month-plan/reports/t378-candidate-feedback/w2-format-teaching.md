# t378 w2: format teaching

## Brief

### Brief: t378-w2-format-teaching (worker)
- Repository: FluxIQ Core and downstream domain. Tree T = `C:/Users/osrs_/FluxStuff/fxwork/t378` (both on `task/t378-candidate-feedback`). R = `T/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`; D = `T/!FluxIQWebExtension/domain/src`.
- Task: the script format and the read guidance match the checks, each rule with a one-line example.
  1. `R/flow-bootstrap/plan/flow-script-format.ts:141` (shared legacy and candidate text) says "A step that types, chooses, waits or reads never needs it", but the domain requires `consequences:` on `web.dom.type` with `submit: true` (`D/runtime/llm-evidence/plan-resolution/step-permission.ts:109-112`); lane B was refused for exactly that. Say: a typing step with `submit: true` sends its form, so it presses and needs the line, `consequences: none` for a search. Keep the legacy text change small; if a legacy byte or ratchet guard test fails, update it deliberately with a t378 comment.
  2. Candidate act example (`AUTOMATION_STUDIO_FLOW_SCRIPT_ACT_EXAMPLE`): add a search step `node: web.dom.type`, `submit: true`, `consequences: none`.
  3. Loop format `:264`: `repeat most:` goes beside `repeat while:` on the span's first step (one-line example); a span whose last step answers ended (a next-page step) needs none. Lane C wrote it under the span's last step.
  4. `:267` and the rows example `:284-301`: the rows a `repeat over` acts on are the rows its listing kept; to act on only some, put the condition on the listing, `extractList.where: [{"field": ..., "atLeast": ...}]`; `recordOutput.process` only shapes the saved answer at the end of the run and never changes which rows a repeat visits. Give the rows example's listing a `where` line. (Lane D confirmed all eight requests instead of the four asked.)
  5. `D/output-nodes/extract-list/catalog-text.ts:234` ("where is optional: omit it, keep every item, narrow later") and the detect description in `D/runtime/llm-evidence/tools.ts:392`: rows a later step acts on are narrowed here with `where`. The catalog text has a 700-character budget: pay for the clause.
  6. Judge advice `R/llm/diagnosis-instructions.ts`: a Flow that acts on more rows of a listing than asked is fixed with the listing's `where`, not a condition on the for-each or the press.
  7. Tests: `R/flow-bootstrap/plan/tests/flow-script-format.test.ts`: every example block in the three format constants parses (`parseAutomationStudioFlowScript`) and assembles (`assembleAutomationStudioFlowScriptPlan`) with no error, using `plan/tests/web-domain-definitions-fixture.ts`; every example step that presses (click) or types with `submit: true` carries `consequences:`; the false sentence is gone. `plan/tests/loop-format.test.ts`: the listing's `where` lands in its `extractList`. Domain: tests beside the two domain files.
- Leave rate-limit and pace guidance alone: a later worker adds it to `flow-script-format.ts` together with its syntax.
- Required reads: the files above; lane D analysis (read-only) `C:/Users/osrs_/FluxStuff/fxwork/t275/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/lane-d-candidate-w2-authoring.md` Q1 and Q4.
- Owns: `R/flow-bootstrap/plan/flow-script-format.ts`, `R/flow-bootstrap/plan/tests/flow-script-format.test.ts`, `R/flow-bootstrap/plan/tests/loop-format.test.ts`, `R/llm/diagnosis-instructions.ts` and the test beside it; `D/output-nodes/extract-list/catalog-text.ts`, `D/runtime/llm-evidence/tools.ts`, and the tests beside them.
- Must not touch: `R/flow-bootstrap/authoring/**` (another worker edits it now; if an example fails inside a file you do not own mid-edit, re-run later and report), any other Core or domain file, any other tree, lab slots or processes.
- Concurrency: other workers edit other files in T now. An error only in a file you do not own is theirs: record it, do not fix it. Core rules: one exported thing per file, a barrel per directory, tests in `tests/` beside the subject.
- Definition of done: Core `npx vitest run <paths>` from `T/!FluxIQ` passes; `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` clean for your files. Domain: run only the tests beside your change: bundle those files as `domain/scripts/test-domain.mjs` does (esbuild, `fluxiq` external) into your own scratch directory and run them with node, or once `DOMAIN_TEST_BUILD_LABEL=t378-w2 node scripts/test-domain.mjs` from `domain/` (the package scripts refuse while Core's source is newer than its build; that is expected); `npx tsc -p tsconfig.json --noEmit` from `domain/`. Never commit; no `pnpm build`; no Lab run or provider call.
- Report to: `T/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/w2-format-teaching.md` (paste this brief at its top; protocol report format; return at most 12 lines).

## Outcome

Partial. All seven items are done and their tests pass. One pin outside my ownership now fails because the judge prose
changed on purpose: Core `R/llm/deepseek/tests/system-prompt-pins.json`, the `loop_verification` and
`loop_verification_build_test` entries. The supervisor has to re-pin it, and a proposed file is ready (see Open
questions).

## What changed and why

Core (`T/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`):

- `flow-bootstrap/plan/flow-script-format.ts`
  - **Legacy format, one clause.** The old sentence was "A step that types, chooses, waits or reads never needs it."
    It now reads "A typing step with `submit: true` sends its form, so it presses and needs the line too:
    `consequences: none` for a search. Any other step that types, chooses, waits or reads never needs it."
    Nothing else in the legacy text changed.
  - **Act example.** It now opens the shop, closes the optional banner, and searches with `node: web.dom.type`,
    `target: t1`, `text: oxford shirt`, `submit: true`, `consequences: none`. It then opens the shirt from the results
    (a click, `consequences: none`) before the earlier steps.
  - **Loop format, `repeat most`.** A new line says where it goes, with a one-line example: "`repeat most:` goes beside
    `repeat while:`, on the span's first step, never under its last: `repeat while: next` then `repeat most: 20`. A span
    whose last step answers ended -- a next-page step -- needs none."
  - **Loop format, the old `:267`.** It is now two lines:
    - the rows a `repeat over` acts on are the rows its listing kept, and to act on only some you put the condition on
      the listing (`extractList.where: [{"field": "rating", "atLeast": 4}]`);
    - `recordOutput.process` only shapes the saved answer at the end of the run, and it never changes which rows a
      repeat visits.
  - **Rows example.** Its listing now has `extractList.where: [{"field": "team", "contains": "colleague"}]`.
  - A t378 paragraph in the file header records why each change was made.
- `llm/diagnosis-instructions.ts`: one sentence was added to `AUTOMATION_STUDIO_RESULT_VERIFICATION_INSTRUCTION`, which
  both judges read. It says that a Flow which acts on more rows of a listing than the request asks is fixed with a
  `where` on the listing step the repeat goes over, not with a condition on the repeat or the press, and that the judge
  names that listing step in `changed`. A provenance comment goes with it.
- `flow-bootstrap/plan/tests/flow-script-format.test.ts`
  - The act-example expectations now cover 9 nodes and three presses (`[], [], ["modify_existing"]`). The search
    declares `[]` and carries `submit: true`, and the quantity step declares nothing.
  - **Legacy digests moved on purpose**, with a t378 comment:
    - format: `fbc8bfdb…87f87d`;
    - completion schema: `4158085b…176965`.
  - **New describe block covering every example in the three constants** (6 blocks):
    - each block parses with no error through `parseAutomationStudioFlowScript`;
    - each block assembles with no error through `acceptAutomationStudioFlowBootstrapResult`;
    - every click step, and every typing step with `submit: true`, carries `consequences:`;
    - the false sentence is gone.
  - **Why the tests assemble through the acceptor.** `assembleAutomationStudioFlowScriptPlan` is deliberately kept out of
    the authoring barrel. The acceptor is the one exported door, and it runs the parse and then
    `assembleAutomationStudioFlowScriptPlan`.
  - **The fixture had no `submit`.** The fixture's `web.output.dom-type` predates the parameter, so the test adds the
    domain's `submit` to it locally, and adds Next page the same way `loop-format.test.ts` does. The shared fixture file
    is not mine and was not edited.
- `flow-bootstrap/plan/tests/loop-format.test.ts`:
  - the rows example's listing node now carries `extractList` `{where: [{field: "team", contains: "colleague"}],
    minItems: 0}`, with an edge `s2:records -> s4:items`;
  - a new row pins the `repeat over`/`where` sentences and the `repeat most` placement sentence.
- `llm/tests/diagnosis-channel.test.ts`: a new row checks that the sentence is in the instruction and in both
  `loop_verification` prompts, with and without `buildTest`.

Domain (`T/!FluxIQWebExtension/domain/src`):

- `output-nodes/extract-list/catalog-text.ts`: the grammar now says "where is optional: omit it, keep every item,
  narrow later; but rows a later step acts on (a repeat over) are narrowed here, by where." It is 591 characters before
  the change and about 645 after, against a budget of 700. The room the paging change (S4) returned paid for the clause,
  so nothing else was cut. A provenance note is in the doc comment.
- `runtime/llm-evidence/tools.ts`: the detect description adds "But rows a later step acts on, a press repeated over the
  read, are narrowed here by where: a condition saved with the answer never changes which rows a repeat visits." It is
  1,781 characters after the change, against a limit of 2,000. A provenance comment goes with it.
- `output-nodes/extract-list/tests/catalog-text.test.ts`: a new test checks the clause, that it follows "narrow later",
  and that the grammar stays within 700.
- `runtime/llm-evidence/tests/tools.test.ts`: two new assertions on the detect description.

## Commands run and observed results

**Core, run from `T/!FluxIQ`:**

- `npx vitest run .../flow-bootstrap/plan/tests/` gave `Test Files 14 passed (14)`, `Tests 132 passed (132)`.
- `npx vitest run .../llm/tests/diagnosis-channel.test.ts .../flow-bootstrap/plan/tests/ .../flow-bootstrap/candidate/tests/trial-gate.test.ts`
  gave `Test Files 16 passed (16)`, `Tests 170 passed (170)`.
- `npx vitest run .../llm/deepseek/tests .../flow-bootstrap/candidate/tests` gave `5 failed | 154 passed (159)`:
  - 4 failures in `deepseek/tests/system-prompt.test.ts`. These are the two `loop_verification` byte pins plus the two
    "keeps every word" cases that compare against the same pins. They are caused by my judge sentence.
  - 1 failure in `deepseek/tests/response-envelope.test.ts`, "what a refused reply cost > carries it on a malformed reply
    …". Another worker has modified that file and `response-envelope.ts` (`git status`). It is not mine.
- `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` exited 0 with no output.
- Scratch probe `npx vitest run --root <scratchpad>/t378w2pin` passed 1 test.
  - **What it checked:** for both `loop_verification` cases, the live `automationStudioDeepSeekSystemPrompt(...)` output
    is exactly the old pin with my sentence inserted after "name the condition, the loop's most passes or the key that
    has to change. ".
  - **What it wrote:** `system-prompt-pins.proposed.json`. `git diff --no-index --numstat` against the real pin file shows
    `2 2`, meaning only those two lines differ.

**Domain, run from `T/!FluxIQWebExtension/domain`:**

- **Bundle.** I wrote my own esbuild script with the same options as `scripts/test-domain.mjs` (`fluxiq` external) and
  bundled the tests into `.test-build-scratch/t378-w2/`, which I removed afterwards.
- **Run.** `node --test` on each bundle:
  - `output-nodes/extract-list/tests/catalog-text`: 9 pass, 0 fail;
  - `output-nodes/tests/definitions`: 18 pass, 0 fail;
  - `runtime/llm-evidence/tests/tools`: 14 pass, 0 fail.
- `npx tsc -p tsconfig.json --noEmit` exited 0 with no output.

## Not verified

- Whether a model now writes `submit: true` with `consequences: none`, `where` on a listing, or `repeat most` on the
  first step. Checking that needs a live run, which the brief excludes.
- The one-line `repeat most` example is not assembled as a script of its own. Only its placement is confirmed by reading
  `authoring/draft-routing.ts`: a repeat line on any step but the span's first is refused, with "say repeat once, on the
  first step of the span".
- The domain's real `web.dom.type` definition was not run through Core assembly. The Core test uses a copy of its
  `submit` parameter (boolean, default false), taken from `D/output-nodes/definitions.ts:286`.
- No full suites were run, and no structure audit was run.

## Open questions or contradictions found

- **Re-pin needed: Core `R/llm/deepseek/tests/system-prompt-pins.json`.**
  - Fix: copy `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/cbe27898-5d09-40ef-80b5-ee091413766a/scratchpad/t378w2pin/system-prompt-pins.proposed.json`
    over it. It is verified to differ only in the two `loop_verification` entries.
  - Alternative: insert the sentence after the anchor above, in those two entries.
  - The test header says a pin moves when Core's own prose does, so this is the intended re-pin.
- **Test fixture has no `submit`.** `plan/tests/web-domain-definitions-fixture.ts` has no `submit` on `dom-type` and no
  Next page node. Both of my test files patch these locally. Updating the shared fixture would remove the duplication.
- **Exploration prompt not checked.** The exploration system prompt (D
  `runtime/llm-evidence/system-instructions/instructions.ts:53`, per lane D) already says to list with a `where` that
  keeps only the rows to act on. It now agrees with the format and the catalog text. I did not read it again.
