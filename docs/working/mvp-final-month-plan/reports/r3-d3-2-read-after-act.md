# r3-d3-2-read-after-act: worker report

## Outcome

Partial. Both parts are done and fail-first. `pnpm --filter @fluxiq-web-extension/domain check` exits 1 at its Core-dist freshness guard. That guard fires because Core source is now newer than its dist, from my edit and the other worker's, and the brief forbids building Core. The check's two `tsc` passes, run directly, both exit 0.

## What changed and why

### Part 1: Core (`C:/Users/osrs_/FluxStuff/fxwork/t275/!FluxIQ`), R = `packages/fluxiq/src/programs/automation-studio/runtime`

- `R/llm/draft-amendment-feedback.ts`
  - Widened `AutomationStudioDraftAmendmentFeedbackStep` to include `id?: string` and `routing?: { kind: string; over?: string }`.
  - Added `repeatOver(listing, steps)`. It finds the first later step whose routing is `repeat` with `over` equal to the listing's name. The name is `listing.id ?? "p<position>"`, matching `automationStudioFlowDraftStepId` in `flow-draft/routing.ts`.
  - Added `readAfterAct(listing, act)`.
  - In `nextStep`, the `changes_nothing` branch now returns `readAfterAct` when such a step exists. Every other case keeps today's text.
  - Updated the doc comment.
  - The new `next` wording, with N = act and L = listing:

    > Step N already repeats over step L, so the loop is in place: rerunning step L only replaces it and never adds a step after step N. A read of the rows after the act is a new step: with the act done on the page, run the read there as a new call ("core.run_node" with add true) so it is added after step N, with a where keeping the rows the instruction asks for -- or write it with write true.

- `R/llm/tests/draft-amendment-feedback.test.ts`: added one test in "a refusal about a listing says what comes next", covering three cases:
  - The 0110 shape: look and acts at 1-5, listing 6 with `id` "s6", press 7 repeating over "s6", `changes_nothing` on 6.
  - Steps without ids, named by position (`p2`).
  - A repeat over a different step, which still gets today's `send {"step": 3, "change": "repeat", "over": 2}`.

### Part 2: Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t275/!FluxIQWebExtension/domain/src/runtime/llm-evidence/node-run`)

- `outcome.ts`: replaced `inFlow: boolean` with:
  - `addable?: boolean`, documented as the brief asked: a kind of step a Flow holds and can be added; in the Flow only once added, as the draft entry shows. The comment cites D3-2.
  - `inFlow?: true`, documented as written-step only.
- `run.ts`: changed the two writes.
  - Look path: `addable: false, inFlow: undefined`.
  - Run path: `addable: node.proposes, inFlow: undefined`.
- `written-step.ts`: added `addable: undefined`. **This file was outside the files I own; the brief said to leave it alone "if it type-checks", and it does not without this change.** `present<WebNodeOutcome>` requires every optional key to be written (TS2345, "Property 'addable' is missing"). It still writes `inFlow: true`, and `present` strips the undefined `addable`.
- `tests/run.test.ts`: added one test, "a node run's result says it is addable, never that it is in the Flow; a written step says it is". It checks:
  - The look: `addable: false`, no `inFlow`.
  - The live press: `addable: true`, no `inFlow`.
  - A written press: `inFlow: true`, no `addable`.
  - No new file was added.

## Commands run and observed results

### Core, from `packages/fluxiq`

- **Before the fix:** `npx vitest run .../llm/tests/draft-amendment-feedback.test.ts` gave `Tests 1 failed | 52 passed (53)`. The new test received the old "Step 6's identical request ... send {"step": 7, "change": "repeat", "over": 6}" text.
- **First run after the fix:** 1 failed out of 78, caused by a capitalisation slip in my own assertion ("a read" vs "A read"). I fixed the assertion, not the code.
- **After that, twice:** `npx vitest run .../llm/tests/draft-amendment-feedback.test.ts .../llm/decision-handlers/tests` gave `Test Files 8 passed (8)`, `Tests 78 passed (78)` both times.

### Downstream

- **Before the fix:** `node run-subset.mjs <domain> d32` on `run.test.ts` and `observed-state-keys.test.ts`, then `node --test`, gave `tests 18, pass 17, fail 1`. The failure was the new test: `addable` was `undefined`, expected `false`.
- **After the fix:** the same command, plus `node-run/tests/unwritten-consequences.test.ts` (the only written-step-related test file), gave `tests 26, pass 26, fail 0`.
- `pnpm.cmd --filter @fluxiq-web-extension/domain check` exited 1 at `scripts/check/core-build.mjs`. It said the check "bundles against Core's COMPILED dist" and asked for a Core library rebuild. I did not rebuild Core, per the brief.
- `npx tsc -p tsconfig.json --noEmit` in `domain` exited 0.
- `npx tsc -p tsconfig.test.json --noEmit` in `domain` exited 0.

## Not verified

- The full `domain check` with a rebuilt Core dist. The `tsc` passes above resolve Core types through the current link; the lead should re-run `check` after the Core build.
- The Core typecheck (`fluxiq:check`) of the two Core files. Vitest does not type-check them.
  - In the new Core test, the routing literals also carry `through`. They are passed through a variable, so excess-property checks should not apply.
- That `context.draftSteps` at runtime carries `routing.over` as the step id. I read this from the `routing.ts` type and from `route.ts`, which writes `automationStudioFlowDraftStepId(over)`; I did not exercise it through the loop.
- No live, Lab or browser run.

## Open questions or contradictions found

- The brief said to leave `written-step.ts` as is if it type-checks. It cannot, because `present` requires every optional key to be written, so it needed the one-token change described above.
- `observed-state-keys.test.ts` lists `inFlow` among the step keys that must not be page keys. `addable` is not in that list. I did not own that test, so I left it; adding `addable` there would be a one-word follow-up.
- Other Core text that tells the model about `inFlow` (prompts, tool descriptions) was not searched or changed. A search of the downstream domain found no other reader.
