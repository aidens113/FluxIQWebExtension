# Generic act-claim feedback integration

Status: Complete
Owner: resume-live-prep worker
Updated: 2026-10-03
Scope: Core instructed-acts advisory feedback only; no provider/action execution changes.

## Current State

Implemented the provider-free regression and informational correction motivated by A run 3: an explicit cart act claimed on a same-place Spain choice now carries `claimSaid` beside its unchanged `done` coverage. The model and build-test judge receive the checklist sentence through the existing checklist serialization, so both can review the actual control/action instead of treating a claim alone as demonstrated completion.

The sentence says the known control words do not name the requested verb/kind, the claim remains, and a different required control needs a distinct authored step. It explains that a checked rerun verifies its target without repeating a lasting effect and does not add a distinct action. Whole-Flow test/judge remain authoritative. No new completion refusal, act withdrawal, automatic press, permission rule or budget change.

Blank target/control evidence yields no warning. Set/open acts often use only option/destination names and yield no warning. Legitimate controls use the existing kind vocabulary, including Add/cart/basket/watchlist/wishlist. Vocabulary is extracted from `check.ts` into one `kind-words.ts` module rather than copied into a second map. Whole-word matching avoids treating Address as Add. Navigation mismatch can mention a different place using the existing opaque replay-place helper; no reorder instruction is introduced.

## Owned files

- `runtime/flow-bootstrap/instructed-acts/claim-doubt.ts`: new conservative advisory function.
- `kind-words.ts`: extracted existing act-kind vocabulary, unchanged entries.
- `check.ts`: imports the extracted vocabulary; no claim-check rule change.
- `checklist.ts`: adds optional advisory `claimSaid` for the existing standing's step; preserves standing and choices.
- `index.ts`: exports new focused modules.
- `tests/claim-doubt.test.ts`: 13 cases covering mismatch, valid synonyms, absent words, fallback control, set/open exemption, whole words and page transition.
- `tests/checklist.test.ts`: added failing-first same-place Spain/cart case proving advice appears while done/todo/claims/check result remain unchanged.

All paths above are under Core `packages/fluxiq/src/programs/automation-studio/`. No edits to t261 `choice-order.ts`, flow-draft, rerun runtime, service, other workers' files, old trees or shared documentation.

## Validation

Before implementation: heavy-slot wrapped owning checklist file **1 failed / 24 passed**, specifically missing `claimSaid` on the same-place false claim. An intermediate wiring error compared a standing's step object with a position; the same regression caught it and it was corrected to use the standing's actual step.

After implementation: heavy-slot wrapped `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/tests` **7 files / 244 tests passed**, including existing seven page-aware choice-order cases, all claim parsing/check cases and the new advisory regressions. `git diff --check` exit 0 on combined Core tree.

No package typecheck, build, structure audit, provider call, live browser or cost comparison performed by this worker; supervisor verifies combined tree. Feedback does not by itself guarantee a model will author the missing action, nor prove that retargeted checked-rerun resolved inputs are correct. Those remain independently testable runtime concerns and the capped live run remains necessary.

## Supervisor / Claude continuation

Review the new lexical advisory as intentionally fallible evidence: unusual or localized controls can disagree with the vocabulary and still accomplish the act. The wording preserves that possibility. Verify checklist value reaches the actual model/judge context, typecheck/build the combined paired tree, then run the capped headed extension-chat scenario. Compare retained cart action, all four final facts, judge consistency, repair calls and build/run spend; do not claim live cost savings from the 244 provider-free tests.
