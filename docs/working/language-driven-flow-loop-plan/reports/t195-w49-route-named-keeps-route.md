# t195-w49 route-named-keeps-route: worker report

## Outcome

Partial. Tasks 1 and 2 are done, with failing tests written first. Tasks 3 and 4 are blocked. They need edits to files the brief does not let me own, and one of those files is on its "Must not touch" list. The exact list is under "Open questions" below. The lane's earlier uncommitted edits are untouched.

## What changed and why

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ`. `R` = `packages/fluxiq/src/programs/automation-studio/runtime`.

### Task 1: the shortcut and its caveat are now one sentence

- `R/llm/deepseek/request-body.ts`, `FLOW_START_LOCATION_NOTE`. The shortcut sentence now opens: "Unless the person's instruction says how to get there (pages, menus or links to go through: then follow that route and keep its steps), the Flow's first step may instead go straight to the address where the work begins, ...". The rest of the sentence is unchanged. The header comment explains the user's rule.
- `R/flow-draft/entry.ts`, `AUTHORED_INSTRUCTION`. The sentence is now: "Unless the person said how to get there (then follow that route and keep its steps), you may rerun step 1 with the address where the work begins once seen stable (no session-like parameters) and drop the steps that only travelled there; keep optional dismissals."
  - It is 26 bytes longer than the old sentence. The answerability test still passes, so the 5,000-byte budget did not move.
  - The budget could not have moved from my files anyway. It is set in `R/tests/deepseek-bootstrap/tests/harness.ts:287` (`draftObservation(draftValue, 5_000)`), which I do not own. The harness also computes `overBudget`, which the test asserts is false.
  - The comment above the constant says why the sentence is kept short.
- Tests:
  - `R/llm/deepseek/tests/request-body.test.ts`: one new test. Exactly one sentence holds the shortcut, and that sentence starts with the caveat.
  - `R/flow-draft/tests/entry.test.ts`: the same new test, plus the existing first-step test updated to the new wording.

### Task 2: the reading also returns `route`

- The prompt and schema live in `R/action-permissions/instructed.ts`. The reading's question is the schema's descriptions, sent as the completion schema.
  - `AUTOMATION_STUDIO_INSTRUCTED_CONSEQUENCES_SCHEMA` gains an optional `route` string, 3 to 300 characters. Its description asks for the instruction's own words that say how to get to where the work is done, such as "go to the home page, then open Friends, then Friend requests" or "use the menu". It says to leave `route` out when the instruction only says what to do, or names the place without saying how to reach it.
  - `required` is still `["instructed"]`.
  - The `instructed` description no longer says "Answer only this", since the reading now gives two answers.
  - New export `AUTOMATION_STUDIO_INSTRUCTION_QUOTE_LENGTH` (min 3, max 300).
- The parse lives in `R/action-permissions/instruction-route.ts` (new).
  - Exports the type `AutomationStudioInstructionRoute` (`{ instructionId, instructionDigest, quote }`) and `readAutomationStudioInstructionRoute({ result, instructions })`.
  - It returns nothing unless the quote is word for word in an active instruction.
- The screening lives in `R/action-permissions/instruction-quote.ts` (new).
  - `automationStudioInstructionQuotedIn(quote, instructions)` is the old private `comparable` check, moved here.
  - `instructed.ts` now uses it too, so quotes and routes are screened the same way.
- `R/action-permissions/index.ts`: the barrel exports both new files.
- The result is kept in `R/service/instruction-authority.ts`.
  - The reading is now made at most once and kept there, so the permission gate's `derive` and the new `route()` share one provider call. A failed call rejects and is not retried, which is the same as before because the gate already memoised it.
  - New fields on the returned object, typed as the new `AutomationStudioInstructionAuthority`:
    - `route(): Promise<AutomationStudioInstructionRoute | undefined>` makes the reading if it has not been made yet.
    - `routeRead()` returns what the reading found without making a call.
  - `derive` and `usage` are unchanged for the code that calls them.
  - Where the reading is wired: `R/service.ts:1554` creates the authority, `creation.reading(runHarness)` in `R/service/flow-bootstrap-commands/creation-purse.ts` logs it as phase `read`, and `R/action-permissions/gate.ts` keeps `instructed` (`instructedFor`).
- Tests:
  - `R/action-permissions/tests/instruction-route.test.ts` (new): the schema, a kept route, no route given, and screening.
  - `R/service/tests/instruction-authority.test.ts` (new): one call shared by `route` and `derive`, `routeRead` before and after the reading, no route for the open instruction, and an ungrounded route dropped.

## Commands run and observed results

All commands ran from the Core root.

- Failing first, task 1: `npx vitest run ... flow-draft/tests/entry.test.ts llm/deepseek/tests/request-body.test.ts` printed "2 failed (2) files, 3 failed | 26 passed". The new one-sentence tests in both files failed, for example "expected 'The Flow's first step may instead go…' to match /^Unless the person's instruction say…/". The updated entry first-step test also failed.
- After task 1, the same two files plus `tests/deepseek-bootstrap/tests/answerability.test.ts`: "3 passed (3), 32 passed (32)". The 5,000-byte draft budget assertion passes.
- Failing first, task 2: `npx vitest run ... action-permissions/tests/instruction-route.test.ts service/tests/instruction-authority.test.ts` printed "Failed Tests 7". The errors were "expected undefined to be 'string'", "readAutomationStudioInstructionRoute is not a function" and "reading.routeRead is not a function".
- After task 2: `action-permissions` plus `service/tests/instruction-authority.test.ts` printed "7 passed (7), 82 passed (82)".
- The brief's directories: `npx vitest run --exclude ".tmp/**" --testTimeout=30000` over R/action-permissions, R/service/tests, R/llm/tests, R/llm/evidence-loop, R/llm/deepseek/tests, R/flow-draft, R/tests/service-authoring, R/tests/service-bootstrap and R/tests/deepseek-bootstrap, with R written out in full. It printed "Test Files 114 passed (114), Tests 1140 passed | 1 skipped (1141)". The full output is in the scratchpad at `t195-w49-vitest.txt`.
- Typecheck: `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195 w49 core check" pnpm --filter fluxiq check` exited 0.
- Audit: `node scripts/structure-audit.mjs` printed "structure-audit: passed (242 warning(s), 349 baselined)". It reported no warnings on any changed file. `R/llm/evidence-loop.ts` was not touched.

## Not verified

- No live model has answered the new `route` question. Whether DeepSeek quotes "Go to the home page, open Friends, then Friend requests" and leaves out "Go through my friend requests" has not been measured.
- Task 3 is not done. The start-location note and the drafting guide do not yet change when a route was quoted, and no rerun or amendment is refused. `routeRead`/`route` have no production caller yet.
- Task 4 is not done. There is no scripted service test of the keep-the-route behaviour.

## Open questions or contradictions found

Task 3 cannot be wired inside the owned files. These edits are needed, and the supervisor should own them in one serial brief:

1. **`R/flow-draft/amendment.ts` (Must not touch).** The refusal reason is the closed union `AutomationStudioFlowDraftAmendmentRefusal["reason"]` at line 178. A rerun refused for a quoted route needs a new reason, for example `route_named`, and a field for the quote, for example `route?: string`. `REFUSAL_REASONS` in `R/llm/draft-amendment-feedback.ts` is a `Record` over that union, so the words for the refusal cannot be added until the union has the reason.
2. **`R/llm/decision-handlers/amendment.ts` and `types.ts` (not owned).** The handler is synchronous and calls `automationStudioLlmEvidenceRerunRequest` at line 42. "If the reading has not run yet, run it first" needs an `await`.
   - The cheapest way is to make the handler async and add `await` at `R/llm/evidence-loop.ts:710`. That adds no line to the file, which is at its 800-line budget.
   - The handler context then needs `instructionRoute?: () => Promise<AutomationStudioInstructionRoute | undefined>`, awaited only when a rerun targets the Flow's first kept step and its merged input changes an address, so other reruns never pay for the reading.
   - `rerun-request.ts` then takes the resolved quote as a parameter, and refuses with the new reason when the address changes.
3. **The loop's input type and `R/service.ts` (not owned).**
   - Pass `authority.route` into the loop, next to `lastingActs` around service.ts:1574.
   - Pass `startRoute: authority.routeRead()?.quote` into the `flowBootstrap` request context around service.ts:1603.
   - That needs a `startRoute?: string` field on `AutomationStudioLlmTaskRequest["context"]["flowBootstrap"]`, so that `request-body.ts` can pick a route variant of `FLOW_START_LOCATION_NOTE`.
4. **`R/llm/decision-context/shown.ts:37` (not owned).** It builds the draft entry. It needs to pass the route to `automationStudioFlowDraftEntry`, whose input I could then extend in `entry.ts` with a route variant of the guide sentence. The loop's `draft` input would need a getter for the route, because the route is learned during the build.
5. **A design choice for the supervisor.** The reading runs only when the build first meets a lasting act, so the first decisions are shown the shortcut even for an instruction that names a route. The rerun refusal then catches it. If the note and guide should be right from the first decision, the reading must run before the first decision whenever a `startLocation` is set. That adds one paid call to every such build, including read-only ones, which until now never made the reading.
