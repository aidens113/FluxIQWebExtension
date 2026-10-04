# Explicit repeat removal and quantity repair feedback

Worker: resume-ab. Date: 2026-10-03. Status: implemented, source frozen; owning regressions passed. No provider/panel/browser/commits. Supervisor owns shared architecture docs, integration checks and live acceptance.

## Why this change

[B run2 debug](../../language-driven-flow-loop-plan/debugs/run-mustzxhi-2e2cda87.md) found 27/38 paid decisions spent on amendments; a singular quantity step carried a row repeat, keep could not clear it, and generic act-already-named feedback prescribed another row loop. The whole run cost .049652802 but produced no Flow. Both missing cart acts remained incomplete.

## Behavior implemented

- New explicit `unrepeat` amendment removes only the named step's existing repeat routing. It changes no disposition, input, act claims, settings or other routing. On a non-repeat it reports existing `already_so` with applied0; repeated removal never counts as progress.
- Clears stale replay marks on that step and all later steps: the former repeated span and following steps now execute in another context. Earlier marks remain.
- Existing `keep` and `keep` carrying `act` semantics are unchanged: intentional row loops remain. A second independent loop remains when the mistaken loop is removed.
- Decision parsing accepts only `step`/`change` for unrepeat; mixed act/input/settings/over edits are withheld rather than silently applied. Those operations must be separate amendments.
- Amendment schema names unrepeat and explains removal of the repeat at the start of its span. No separate tool or provider call required; scripted loop removes the repeat after two exploration actions without a third tool execution.
- Context-free act-already-named feedback now says correct the actual checklist todo, without prescribing row repetition. When the refusal names a quantity choice on a step carrying repeat, `next` gives the exact unrepeat amendment, conditioned on quantity_is_a_repeat, followed by own-item quantity control and missing acts.
- Strict quantity-is-repeat checklist advice now names unrepeat. The quantity fault rule is unchanged. Regression proves removing the repeat corrects that fault while both missing cart acts still refuse completion.

## Exact files

All relative to Core `packages/fluxiq/src/programs/automation-studio/runtime/`:

1. `flow-draft/amendment.ts`.
2. `flow-draft/tests/amendment.test.ts`.
3. `flow-draft/tests/routing.test.ts`.
4. `llm/draft-amendment-feedback.ts`.
5. `llm/tests/draft-amendment-feedback.test.ts`.
6. `llm/evidence-loop-decision.ts` (strict parser support required).
7. `llm/evidence-loop/tests/authored-draft.test.ts`.
8. `flow-bootstrap/instructed-acts/quantity-fault.ts` (advice only).
9. `flow-bootstrap/instructed-acts/tests/object-binding.test.ts` (supervisor explicitly released existing owner test instead of nonexistent quantity-fault.test.ts).

No other source or shared docs touched; prior lane trees and runtime/env untouched. Recovery-status worker's partition stays separate.

## Validation observed

All tests under heavy wrapper, from Core task t262, using `pnpm --filter fluxiq exec vitest run <owning paths>`.

- **Failing first:** amendment and feedback files: 3 failed / 50 passed. New removal left repeat intact; unsupported unrepeat fell through into an unrelated disposition edit; singular quantity feedback still prescribed row repeat.
- **Initial owner run:** 5 files / 151 tests: amendment24, routing14, object-binding36 and authored-draft47 all passed; feedback29/30 had one established done-act wording pin. Preserved that existing useful done-act sentence rather than changing its meaning/test.
- **Final rerun:** feedback file only, **30 tests passed / exit0**. Other four files/source have not changed since their passing run. Final owning coverage is **5 files /151 tests passed**, observed in the initial run plus corrected feedback rerun.
- `git diff --check` exit0; no whitespace diagnostics (only line-ending warnings on supervisor-authored working docs).
- Supervisor must inspect package typecheck, structure audit and rebuilt Core before any new live lane. No full sweep performed.

## Remaining limits

This proves an executable repair seam, not that Flash will select it correctly on B. A bad choice under a repeat whose first step is elsewhere needs unrepeat at that span's first step, as checklist advice states; contextual `next` names the precise step only when that choice itself carries the repeat. Legitimate plural work must remain repeated. No new B provider spend or persisted playback/remembered-store acceptance measured.
