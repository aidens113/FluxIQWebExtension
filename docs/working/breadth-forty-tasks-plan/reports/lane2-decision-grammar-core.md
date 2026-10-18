# Report: lane2-decision-grammar-core

Core lane tree `C:/Users/osrs_/FluxStuff/fxwork/t565/!FluxIQ` (branch `task/t565-a8-lane-2`). Nothing was built, nothing
under `dist` was touched, and nothing was committed. Evidence: run-mvcwp3wh-bcea2115.

## Outcome

Done. All three parts are in, and every requested check passes. Replaying the run's real readable reply (step 0011)
through the changed parse with the real supervisor tools: before the change it was refused
`error:llm_output.unexpected_field:response.decision`; after it, it parses with no error and
`info:llm_output.key_moved_into_input` `{"toolId":"project.write_plan","movedKeys":["reason"]}`, and its input keys
are `taskSpec,subflows,reason`.

## What changed and why

Paths are relative to `packages/fluxiq/src/programs/automation-studio/runtime/llm/`.

### Where the fold goes, and why

No module checks a `tool_call` decision's `input` against the tool's declared input schema in a generic way. Each
tool's host checks its own input, for example `project-agents/supervisor/tools.ts` for `project.write_plan`. The first
refusal of a key beside `input` is the harness parse, `harness/provider-result.ts` `rejectUnexpectedFields`, which runs
inside `harness/run.ts`. The loop never sees a decision the harness refused. So the fold has to run in that parse,
before the check.

The parse had no access to the tools. `harness/run.ts` does, through `input.evidenceLoop.tools`, which holds the tools
offered to this decision, each with its `inputSchema`. That made two changes necessary:

- **`harness/run.ts` (one line, outside my listed files):** it now passes `input.evidenceLoop?.tools` to
  `parseAutomationStudioLlmProviderResult`. The brief allowed placing the fold "where they are known". The new fourth
  parameter is optional, so other callers behave as before.
- **`harness/provider-result.ts`:**
  - `parseAutomationStudioLlmProviderResult` and `parseAutomationStudioLlmStructuredResponse` take an optional
    `evidenceTools`.
  - For an evidence decision, the order is now: `inferredEvidenceToolCall`, then the new `foldedEvidenceToolCall`,
    then `validateUnknownEvidenceToolDecision`. So the unexpected-field check, and everything after it (the loop's
    parse, the tool's input checks, permission gates, the repeat guard), sees the folded input.
  - `foldedEvidenceToolCall` records the info diagnostic `llm_output.key_moved_into_input` at path `response.decision`.
    Its metadata is `{ toolId, movedKeys }`. The keys are taken from the tool's schema, never from the provider's
    values or words.
  - The folded decision reaches the response through the existing `decision !== value.decision` return.

### The fold module

The fold lives in a new directory, `tool-call-keys/`, with `folded.ts` and an `index.ts` barrel. I tried it first in
`harness/`, where it broke two audit limits: `harness/` went to 26 files (limit 25), and `harness/tool-call-keys/`
broke the 9-segment depth limit. It imports nothing from the harness, so there is no deep import past a barrel and no
cycle.

`automationStudioLlmToolCallKeysFolded(decision, tools)` moves a key only when all of these hold:

- the decision is a `tool_call` whose `input` is an object;
- the tool it names was offered to this decision;
- that tool's schema declares the key, either in its top-level `properties` or in a top-level
  `oneOf`/`anyOf`/`allOf` variant;
- `input` does not already hold the key;
- the key is not one of the tool call's own keys (`kind`, `callId`, `toolId`, `input`, `add`, `act`, `place`), and is
  not `write`.

It returns `{ decision, toolId, movedKeys }`, or `undefined` when nothing moved. Keys are written with
`defineProperty`, so a key like `__proto__` cannot pollute a prototype (there is a test for this).

### Naming the other keys (part 2)

- **`harness/provider-result.ts` `rejectUnexpectedFields`:** a non-`write` key beside a tool call's `input` is still
  refused `llm_output.unexpected_field` at path `response.decision`. It now also carries the closed metadata
  `{ expectedPath: "response.decision.input" }`. The `write` path and its diagnostic are byte-for-byte as before.
- **`unusable-decision.ts`:**
  - Adds a third field issue, `INPUT_FIELD_ISSUE`
    `{ code: "llm_output.unexpected_field", path: "response.decision", expectedPath: "response.decision.input" }`.
  - `fieldIssuesOf` reads it only from a diagnostic that has that metadata. Otherwise an unexpected key on a
    `complete` or `amend_draft` decision, which shares the same path, would be told about tool calls.
  - `screenedFieldIssues` now also matches `expectedPath`, because two issues share a code.
  - `FIELD_ISSUE_INSTRUCTIONS` is now keyed by path instead of code. The new instruction reads: "A tool call holds only
    kind, callId, toolId and input, and add, act or place where the decision schema lists them beside input; every
    other key goes inside response.decision.input, where the tool's input schema declares it. This corrects grammar
    only; existing permission and tool checks still apply."
  - The header comment is extended and cites the run.

### Bracket cases (part 3)

In `unusable-decision.ts`, when an unreadable reply's case is `content_mismatched` or `content_unclosed`, and a tool
call was offered (or the caller did not say what was offered), the instruction now adds: "A tool call is {kind,
callId, toolId, input: {...}}: every key of the tool's input goes inside input, and input closes before the decision
does."

I put this in the model-facing feedback rather than in `unreadable-reply.ts` `CASE_SAID`, because that text is also
shown to the person in the build's ending. `unreadable-reply.ts` is unchanged.

### Tests

- New `tool-call-keys/tests/folded.test.ts` (5 tests): unit tests of the fold rules, including prototype safety.
- New `harness/tests/tool-call-keys-folded.test.ts` (9 tests): through the parse and the real harness. Covers the
  move with its info diagnostic, keeping `add` and `act` beside `input`, a key from a schema variant, no overwrite, an
  undeclared key refused with the closed metadata and no provider key in the output, `write` never moved, nothing
  moved without tools or for a tool that was not offered, and the resulting `fieldIssues`.
- New `tests/decision-kind/tests/misplaced-input-key.test.ts` (7 tests): the new correction and its instruction,
  `write` and another key together, `write` alone unchanged, a `complete` decision with an extra key gets no
  correction, a forged `expectedPath` is not taken, and the nesting sentence for the two bracket cases only.
  - It goes in this folder because `runtime/llm/tests/` already holds 25 files and `unusable-decision.test.ts` is at
    797 of 800 lines.
- `tests/unusable-decision.test.ts`: one changed expectation. A `PRIVATE_FIELD_NAME` beside `input` used to produce no
  field issues; it now produces the closed input correction. The check that no provider key is reflected still
  passes.

## Commands run and observed results

- `npx vitest run` in `packages/fluxiq` on these files and folders (all under
  `src/programs/automation-studio/runtime/`):
  - folders: `llm/tool-call-keys/tests`, `llm/harness/tests`, `llm/tests` (including `decision-kind/tests`);
  - files found by grepping for unexpected_field, unreadable replies and the feedback function:
    - `llm/decision-handlers/tests/refusal-way-out`
    - `llm/deepseek/tests/response-envelope`, `llm/deepseek/tests/unclosed-reply`
    - `llm/evidence-loop/tests/provider-unavailable`, `rerun-input`, `unreadable-replies`
    - `llm/evidence-progress/tests/progress-trace`
    - `llm/harness-options/tests/bootstrap-completion`
    - `llm/node-tools/tests/replay-draft`
    - `llm/throw-account/tests/read`
    - `flow-bootstrap/plan/tests/parsing`, `flow-bootstrap/tests/plan`
    - `tests/service-bootstrap/tests/unreadable-replies`
  - Result: `Test Files 65 passed (65)`, `Tests 824 passed (824)`.
- `npx tsc --noEmit -p tsconfig.json` in `packages/fluxiq`: no output, exit 0.
- `node scripts/structure-audit.mjs` in Core: `structure-audit: passed (397 warning(s), 1155 baselined).`, exit 0.
  - Earlier runs failed on my own placements: `as-never` casts in my tests, `harness/` at 26 files, the
    unusable-decision test at 848 lines, then the depth limit. Each was fixed as described above. The 397 warnings
    are advisory line-count warnings on files I did not change.
- Replay: a temporary vitest file, deleted right after, parsed step 0011's real `response.json` content with
  `automationStudioProjectSupervisorTools()`. Results are quoted under Outcome.

## Not verified

- No live run and no Lab run (not asked for). The real loop, from DeepSeek adapter to harness to supervisor host, was
  not exercised on the changed source.
- Step 0017 was not replayed. Its content has trailing text after the JSON, which the DeepSeek adapter's extraction
  handles but my scratch `JSON.parse` did not. It has the same `reason` placement as 0011.
- No full suites were run (per the twice-a-day rule).
- The info diagnostic reaches the harness result's `diagnostics` and the call receipt's `issueCodes` (`callOutcome`).
  I did not check whether the Lab's step-log files show it. Those files are written by the adapter before the harness
  parses, which is the same as the existing `llm_output.decision_kind_inferred` warning.
- Architecture docs were not updated.

## Open questions or contradictions found

- The brief's wording for the instruction says "a tool_call holds only kind, callId, toolId and input". Taken
  literally, that would tell an authoring model to put `add`, `act` and `place` inside `input`, where the loop does not
  read them. I added "and add, act or place where the decision schema lists them beside input".
- The nesting sentence is shown only when a tool call was offered, since a decision offered no tools cannot answer
  with one.
- `harness/run.ts` was not on my list of files. The one-line change there is needed so the parse can see the tool
  schemas.
- The tree also has uncommitted `repeat-guard/` changes that are not mine (another worker's covered-repeat work). I
  did not touch them. The audit and typecheck ran over them as well.
