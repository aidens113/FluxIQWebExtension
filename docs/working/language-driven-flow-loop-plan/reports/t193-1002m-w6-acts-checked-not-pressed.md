# t193-1002m-w6: acts checked, not pressed (worker report)

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQ` (branch task/t193-live-self-repair). No commits.
`R/` = `packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

Done. Task G: a changing step that names a bare act id is verified (checked, never pressed) whatever it declared,
except when the next proposed step found the target on another page. Task F': a choice made after its act's step is
said as information on the verdict and on the checklist. It is never a refusal.

## What changed and why

### Task G: one predicate, `automationStudioFlowDraftStepReplayMode(step, steps)` (`R/flow-draft/verify-only.ts`)

- The signature is now `(step, steps)`. `steps` is the whole draft, and the predicate finds the step's next
  proposed step in it (private `nextProposed`: identity in the proposed list, else by position).
- The rule, in order:
  1. A step that only reads: `replay`.
  2. It declares anything lasting: `verify`. This is D1, unchanged.
  3. It names a bare act id (`/^a[0-9]+$/` after trim and lowercase, on `step.acts`): `verify`, unless
     `automationStudioFlowDraftStepMovedTarget(step, next)` is true, which compares `replay.from` whole. Then it
     is `replay`, today's rule.
  4. Anything else: `replay`.
  A choice (`a2.quantity`) is never an act.
- `verified`, `present` and `unreproducible` semantics are untouched. So are `WithholdsLater`, the excusing rules,
  and the outcome words.
- The header has a new paragraph on the rule, its exception, and the three callers.
- The export count is unchanged at 8. I first added two exports, then made the next-step lookup private and
  dropped a separate "declares lasting" export to stay under the 8-value advisory.
- Callers, found from verify-only's exports (only the call changed, plus a three-line comment):
  - `R/llm/node-tools/replay-draft.ts` `automationStudioFlowDraftReplaySteps`: `(step, input.steps)`. This one
    function serves both the dry run and the rerun put-back. `R/llm/node-tools/step-place.ts` calls it with
    `steps: input.steps`, the whole draft, so the put-back now checks an act step. step-place.ts itself needed no
    edit.
  - `R/llm/node-tools/run-flow-part.ts`: `(step, input.steps)`.
  - `R/flow-bootstrap/instructed-acts/span.ts`: `(after, steps)`. The result is the same as before, because a step
    named for an act is already passed over there as "claimed". The comment was updated.

### Task F': a choice made after its act's step

- New file `R/flow-bootstrap/instructed-acts/choice-order.ts`. It holds the type
  `AutomationStudioInstructedChoiceAfterAct {id, step, actStep, said}` and the function
  `automationStudioInstructedChoiceAfterAct`, which returns undefined when `step <= actStep`.
- The sentence it builds says the act runs before its choice, so the choice does nothing for it. It adds "unless
  step N changes what the act already did (such as the line it put in a cart)", because a quantity set on the cart
  line after the add is legitimate. It ends with what to do.
- `standing.ts`: a choice that is done keeps `done` and also carries `afterAct: <act step>` when its step's position
  is after the act's done step. This is information only, never a fault.
- `check.ts`: the verdict carries `choicesAfterAct`, both when it accepts and when it refuses. The type change is in
  `contracts.ts`. `ok` is unaffected. The header has a new paragraph.
- `checklist.ts`: the choice item carries `afterAct` and `afterActSaid` (the same sentence). Header paragraph added.
- `index.ts` exports `choice-order.ts`, because its type is on the public verdict. Header line added.

**How it reaches the model and the judge.** The check verdict itself reaches neither on an accepted completion:
- `result-verification/build-test/summary.ts` copies only `missingActs`, and only when `!check.ok`.
- `llm/harness-options/bootstrap-completion.ts` uses only the permission rule.

The checklist reaches both, and it already carries the verdict's per-act state:
- **The model's next turn:** `llm/harness-options/draft-acts.ts` builds `draft.acts` on every decision with
  `automationStudioInstructedActsChecklistValue`, which spreads each choice whole.
- **The build judge:** `buildTest.checklist` in summary.ts, through the same value function.

So I wired F' into the checklist, an existing channel, with no new refusal and no edit outside my files.
`choicesAfterAct` on the verdict is for callers and tests; nothing outside Core's tests reads it today.

### Docs

`docs/architecture/automation-studio/llm-flow-bootstrap.md` got one sentence each:
- the D1 paragraph: acts are verified, with the moved exception, and one predicate decides for the dry run, the
  put-back and `core.run_flow`;
- the part-run paragraph: "or does one of the person's acts in place";
- the acts checklist paragraph: `afterAct`, `afterActSaid` and `choicesAfterAct` are information.

The other worker had already modified this file. I used targeted Edit replacements only.

`docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md` were
regenerated, because they were stale (new exports, shifted line numbers).

### Files

- Changed: `R/flow-draft/verify-only.ts`, `R/flow-draft/tests/verify-only.test.ts`,
  `R/llm/node-tools/replay-draft.ts`, `R/llm/node-tools/run-flow-part.ts`,
  `R/flow-bootstrap/instructed-acts/{span,standing,check,checklist,contracts,index}.ts`, the bootstrap doc, and both
  framework references.
- New: `R/flow-bootstrap/instructed-acts/choice-order.ts`,
  `R/flow-bootstrap/instructed-acts/tests/choice-order.test.ts`,
  `R/llm/node-tools/tests/replay-draft-acts.test.ts`.
- The G unit tests are folded into `R/flow-draft/tests/verify-only.test.ts`, which keeps that tests directory at
  15 files.

## Commands run and observed results

**Failing first.** Before any source change:
`npx vitest run R/flow-draft/tests/verify-only-acts.test.ts R/llm/node-tools/tests/replay-draft-acts.test.ts R/flow-bootstrap/instructed-acts/tests/choice-order.test.ts`
reported `Test Files 3 failed (3)`, `Tests 5 failed | 5 passed (10)`:
- G predicate, stays on its page: `expected 'replay' to be 'verify'`
- F' information line: `expected undefined to deeply equal [ { id: 'a1.quantity', …(3) } ]`
- G dry run: `expected [ 'step' ] to deeply equal [ 'verify' ]` (the Add to cart was pressed)
- G put-back: `expected [ 'step' ] to deeply equal [ 'verify' ]`
- G part run: `expected [ 'step' ] to deeply equal [ 'verify' ]`

The 5 that already passed were the cases that must not change:
- a choice-only step is run;
- a moved act step is run, and the cart count reaches 3;
- a step that only reads is run;
- a2.quantity before a2 gets no line.

The predicate tests were later moved into `verify-only.test.ts` unchanged.

**After the fix:**
- `npx tsc --noEmit -p .` in `packages/fluxiq` printed nothing (exit 0).
- `npx vitest run R/flow-draft/tests R/llm/node-tools/tests R/flow-bootstrap/instructed-acts/tests`:
  `Test Files 35 passed (35)`, `Tests 489 passed (489)`. `verify-only.test.ts` has 16 tests.
- Consumer directories, run before the test fold:
  `npx vitest run R/flow-bootstrap/unfinished-build/tests R/llm/harness-options/tests R/result-verification/build-test/tests R/llm/tests R/flow-bootstrap/tests`
  gave `Test Files 63 passed (63)`, `Tests 739 passed (739)`. A combined rerun of the six directories gave
  `63 passed`, `752 passed`.
- `node scripts/structure-audit.mjs` (Core): `structure-audit: passed (222 warning(s), 349 baselined).` Advisory
  warnings involving my files:
  - `instructed-acts/: 16 source files is past the 15-file advisory threshold`. This is new, from choice-order.ts.
  - `instructed-acts/check.ts: 448 lines`. It was already over at 423 lines.
- `node scripts/docs-reference.mjs --check` first reported "framework-reference.md is stale". After
  `node scripts/docs-reference.mjs` ("Wrote ... (3013 public declarations)"), the check printed "Deterministic
  framework reference is current."
- Core rebuild: `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t193-w6 core fluxiq build" pnpm --filter fluxiq build`
  held slot b2 and exited 0 (`fluxiq:build ... ms 42159`).
  - The dist built at 22:41 (apparently the other worker's) predated my final verify-only.ts, so I rebuilt.
  - Afterwards `dist/.../verify-only.js` has `function nextProposed` and `dist/.../check.js` has `choicesAfterAct`.
  - contracts and client-gateway-websocket were not rebuilt. I did not touch them.

## Not verified

- No live run. Nothing shows yet that the web host answers `replay: "verify"` for an Add to cart with
  `core.replay.verified`. It already does so for declared steps, and the call is the same shape.
- **Risk to watch.** An act step that does not move `replay.from`, but whose in-page effect the next step needs, is
  now verified, so that effect is withheld from the steps after it. Examples: a filter or sort act on a
  single-page app whose address does not change, or an add that opens a drawer the next step presses.
  - A later step that then does not replay is not excused, because `WithholdsLater` is unchanged and excuses only
  moves and person-asked classes. The test would refuse it.
  - I did not widen the excuse. The brief asked to keep the semantics.
- I did not check whether the model's draft-entry instruction or the judge's instruction should mention
  `afterActSaid`. The field carries its own sentence.
- The full Core suite was not run (narrow checks only).

## Open questions or contradictions found

- The brief said "the rerun put-back (`step-place.ts`)" decides verify-or-run. It does not do so itself: it
  delegates to `automationStudioFlowDraftReplaySteps` in replay-draft.ts, so the change landed there and
  step-place.ts is untouched.
- `R/flow-draft/index.ts` needed no new line: verify-only's exports are unchanged in name, and
  `export * from "./verify-only.ts"` already covers them.
- The other worker's files were not edited. The tests in its directories passed on my runs:
  `dry-run-gate.test.ts`, `routing.test.ts`, `step-place-done-again.test.ts`.
- `docs/architecture/automation-studio/llm-flow-bootstrap.md` and the two framework references are shared with the
  other worker's changes in the working tree. The supervisor should regenerate the references once more after both
  land.
