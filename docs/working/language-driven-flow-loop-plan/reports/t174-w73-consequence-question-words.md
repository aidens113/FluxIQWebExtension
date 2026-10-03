# t174-w73 consequence question words (F42): report

## Outcome

Done. Status: **Ready to commit**. The changes are in Core tree `fxwork/t174/!FluxIQ` (R/ = `packages/fluxiq/src/programs/automation-studio/runtime/`):
- `R/action-permissions/cross-check.ts`
- `R/action-permissions/tests/declared.test.ts`
- `R/flow-bootstrap/action-permissions.ts`
- `R/flow-bootstrap/tests/action-permissions.test.ts`

`R/activity/ask/tests/ask.test.ts` was not changed. It uses "Apply it as it stands?" only as fixture text and does not pin the cross-check sentence.

## What changed and why

(a) **The cross-check sentence now uses the person's words** (`cross-check.ts`, `sentenceFor`):
- A new `PLAIN` table, exhaustive over the five classes, names each class in plain words: move money, delete something, send or publish something, change something that exists, create something new.
- Each class nobody declared is followed by the person's own quote from the finding's `quotes`, with whitespace collapsed to one line. If there is no quote, only the plain words appear.
- The sentence has no class codes and no counts. Examples:
  - Undeclared: `Your instruction asks to change something that exists ("…") and create something new ("…"), but nothing FluxIQ did while building this Flow said it would.`
  - Beyond the instruction: `While building this Flow, FluxIQ said a step would delete something, which your instruction does not ask for.`
  - Agreed: `What FluxIQ said its steps would do while building this Flow matches what your instruction asks for.`
  - Not comparable: `Nothing FluxIQ did while building this Flow changed anything, so there is nothing to compare with your instruction.`
- The record keeps its shape. `actions` and `declaredNothing` are still on the proposal, because downstream `packages/test-runner` parses them. Their doc comment now says they count replays and are never said to the person.

(b) **Only money, delete and send/publish raise a question** (`flow-bootstrap/action-permissions.ts`, `saidOutLoud`):
- The gate's list in `R/action-permissions/destructive.ts` (`DESTROYS`) is `move_money`, `delete` and `send_or_publish`. That matches "money, delete and send/publish" exactly.
- If any class nobody declared is on that list (`automationStudioDestructiveConsequences(undeclared)` is not empty), the build opens the same `confirm` ask as before: `parks: false`, no wait, the plain-words sentence plus " Apply it as it stands?".
- Otherwise it asks nothing.
  - The parking port has no entry that is not a question: its ask kinds are `permission`, `choice`, `confirm` and `open`, and all of them expect an answer.
  - So I added an optional `say?: (text) => Promise<unknown>` input to `automationStudioFlowBootstrapActionPermissions`.
  - When `say` is given, the finding is said as a plain line. When it is absent, nothing is said.
  - The finding is still returned and recorded on the proposal (`permission-outcome.ts`, unchanged).
- Nothing refuses or pauses. A failed write is still swallowed.
- I updated the header comments in `cross-check.ts` and the `crossCheck()` doc comment to match.

## Commands run and observed results

All Core commands ran from `fxwork/t174/!FluxIQ`.

**Failing first, with my sources at HEAD and the new tests:**
- Command: `npx vitest run R/action-permissions/tests/declared.test.ts R/flow-bootstrap/tests/action-permissions.test.ts`
- Result: `Tests 7 failed | 19 passed (26)`.
- The received text reproduced the run exactly: "The instruction asks for modify_existing and create_new, and none of this run's 72 actions said it would cause that; 72 of them said they would cause nothing lasting."
- The cart rows failed because `opened` held one confirm ask where none was expected.

**After the fix:**
- Command: `npx vitest run R/action-permissions/tests R/flow-bootstrap/tests R/activity/ask/tests`
- Result: `Test Files 20 passed (20)`, `Tests 222 passed (222)`.

**Typecheck:** `heavy.sh "t174-w73 fluxiq check" pnpm --filter fluxiq check`
- First run failed with 4 errors (TS2554), all in `R/flow-draft/tests/dry-run.test.ts`. That file is w72's and was being edited at the time. None of the errors were in my files.
- Re-run once: `{"build-cache":"reuse","step":"fluxiq:check","reason":"inputs and outputs match the stamp"}`. This means a passing check is stamped for the tree's current inputs, which include my changes.

**Structure audit:** `heavy.sh "t174-w73 audit" node scripts/structure-audit.mjs`
- Result: `structure-audit: passed (218 warning(s), 349 baselined)`.
- No warnings name my files. My largest file is 306 lines.

## New and changed test rows

- `declared.test.ts`:
  - The undeclared sentence uses plain words and the quote.
  - New row for run muqk4u32: 72 declarations and two instructed classes give plain words with whitespace-collapsed quotes, and the sentence matches no class code or count.
  - The beyond-instruction sentence is pinned.
  - The not-comparable sentence is updated.
- `flow-bootstrap/tests/action-permissions.test.ts`, three rows:
  - Create and edit with `say`: one plain line is said and no ask is opened.
  - Create and edit without `say`: nothing is said and nothing is asked, and the finding still carries its classes and quotes.
  - Money undeclared: one `confirm` ask with `parks: false`, nothing waited on, and plain text ending in "Apply it as it stands?".

## Not verified

- **The plain line is not yet connected in the product.** The real build's call to `automationStudioFlowBootstrapActionPermissions` (Core `R/service.ts:1554`) does not pass `say`, and `service.ts` is outside my ownership. Until it is wired, a creation or edit finding is recorded on the proposal and not said in the thread. The one-line wiring is `say: (text) => this.conversations.writerFor({ projectId, subject: { kind: "flow", id: flowId } }).say(text)`, guarded by `this.conversations.available`.
- I did not run a live build or check the extension's display of the new text.
- I did not run Core's wider service-bootstrap tests. A grep found no test outside my files that pins the old sentence or the `declaration-cross-check` ask.

## Open questions or contradictions found

- There is no difference between the gate's list and the brief's list: both are money, delete and send/publish.
- Should `service.ts` pass `say`? The brief says "if the thread has a non-question entry". The conversation writer has one (`say`), but it is not reachable through the parking port this module receives. That decision is the supervisor's.
