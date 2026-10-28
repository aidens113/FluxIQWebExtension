# t772 w8: headed value spec (reloading confirm undo)

## Outcome
Done. One new spec, `apps/extension/e2e/site-reset/tests/office-reloading-confirm-undo.spec.ts`, passes (2 further runs after the first fix; final `1 passed (1.5m)`). Core, domain, helpers and existing specs untouched.

## What the spec does (everything-store, provider-free, headed)
Explore: cart read (ref issued) -> product -> Buy Now (create_new, naming the ref) -> Change -> other saved address radio (declares nothing) -> "Deliver to this address" (modify_existing; page reloads on /checkout showing the other address).
Then, all naming the confirm act under `undoes`:
1. `look.cart`: navigate to the cart. Admitted; `resetSettlement.open == act-4`, no `settled`, `actsStillOpen == [act-4]`.
2. submit a one-step flow (open + Buy Now), `core.test_subflow` (`trial.open`): `candidate.trial_reset_required` / `acts_in_place`, `actsToUndo == [act-4]`, no `actsUnsettleable`.
3. navigate to /checkout; `undo.chooser` (Change, declares nothing) ok, act-4 still open; `undo.choose` (the unchecked original radio, declares nothing) ok, act-4 still open; `undo.confirm` (declares modify_existing) ok, `resetSettlement.settled == act-4`, `actsStillOpen == []`.
4. `trial.settled`: `yes`, act-4 not in `actsToUndo`, `actsUnsettleable` empty. Ending `proposed`.
Also asserted: no answer's codes include `no_destination_read_before` or `no_item_identity`; every undo call's permission declaration is permitted with the declared consequences ([] / [] / modify_existing).

## Core's actual answers (matches the brief, with two notes)
- Act numbering: Core numbers every admitted press: Buy Now act-1, chooser act-2, radio act-3, confirm act-4. The first draft named act-2 (the chooser) and failed on `actsToUndo == [act-4]`; fixed in the spec, not a Core issue.
- The wire answer does not expose an admission kind. "step" and "own" cannot be read from `core.run_node` answers; they show as `ok:true` plus the `resetSettlement` sequence above (open, open, open, then `settled`). The spec asserts that sequence, not a literal `own`/`step` field. If an explicit kind is wanted it must be added to Core's answer.
- Core's own pre-trial look (`site-reset.place.1.arrival`) leaves the browser on /checkout, so the spec re-navigates there before the undo steps.
- Settle words while open: "The value this act set still shows at .../checkout: set it back where it shows -- choose the value it replaced ... then press the control this act pressed, declaring modify_existing ... under undoes -- then look at the page." (value witness works end to end live, so the w4b call sites appear wired in this tree).

## Commands and results
- `cd fxwork/t772/!FluxIQ && pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` -> fluxiq rebuilt (224 s), others reused; Done.
- `cd apps/extension && pnpm test:e2e:build` -> extension build verified (firefox 22 files, e2e-chromium 22 files).
- `NODE_OPTIONS=--no-experimental-strip-types node node_modules/@playwright/test/cli.js test -c e2e/playwright.config.ts site-reset/tests/office-reloading-confirm-undo.spec.ts --workers=1`:
  - run 1: `1 failed` (expected act-2 in actsToUndo, got act-4; plus `back.checkout` stale-handle `target_unobserved`).
  - run 2: `1 passed (1.6m)`.
  - run 3 (with settlement assertions): `1 passed (1.5m)`.
- The build gate did not refuse; no Core rebuild retry was needed.
- Diagnostic: `apps/extension/e2e/test-results/artifacts/site-reset-tests-office-re-7e66b-al-choice-is-confirmed-back/reset-office-reloading-confirm.json`.

## Not verified
- Literal admission kinds `own` / `step` (not on the wire, see above).
- That the unrelated-cart look would still not settle if Core's concurrent site-reset edits change; one run only.
- No typecheck of the spec beyond Playwright's own transform (a tsc check on `e2e` was attempted only if available, nothing printed for this file).
- Whole folder not run.
