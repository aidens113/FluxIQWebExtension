# site-reset-undo report (t719, R1)

Worker `site-reset-undo`. Stopped on the coordinator's wrap-up order, after the fix and its narrow checks were done. Nothing is committed. All files are left as they are.

## Outcome

Done for the code and the narrow checks. Live behaviour is not verified: no Lab run was made.

## Cause of R1

I confirmed the cause from the t707r3b trial traces (`trial-sessions.json`) and the source.

- An undo is admitted only on the act's own item token, on an item the act created on its own page, or in a follow-up dialog (`ledger.ts` `target()`).
- **Add to Cart** is pressed on the detail page, where the button sits in no row: `spot=null`, and the page's items are the same before and after. The cart line appears on another page, so no undo there could ever match. Every undo was refused as `candidate.undo_wrong_target`, and the act was kept.
- **Save for later, Decrease and Move to cart** are `span`s with a tab stop. The extension's `isRowControl` rejects them, so they carry **no item token**: every cart-page trial step had `spot=null` although the cart lines had tokens. Their undos were refused the same way.
- The ledger kept each refused act, so every later trial ran on the leftovers. It does not hold any of these acts as not undoable: all of them were recorded with `undoable: true`.

## What changed and why (uncommitted)

The new general rule: an undo may also be tied to its act by **what both are about**.

- The domain now sends two more opaque tokens, both `s:` digests of one kind:
  - `subject`: the title of the item's row, or for a lone control the nearest titled part of the page around it.
  - `page`: the page's main heading (its first `h1`).
- The ledger admits an undo when `control.subject` equals the act's `subject`, or the act's `page` where the act sat in no item. The match must be positive: a token missing on either side never matches.
- The undo may only declare classes that reverse the act's (`REVERSES` in `ledger.ts`): an add is undone by a delete or a change, a change by a change, a delete by creating again.
- Nothing is removed unasked through this path. A follow-up confirmation dialog is allowed once, as for an undo on the act's own item.
- `move_money` and `send_or_publish` stay not undoable.

Files changed:

- **Core** (`fxwork/t719/!FluxIQ`, branch `task/t719-site-reset-undoable-acts`):
  - `runtime/action-permissions/declaration.ts`: reads `control.subject` and `control.page`.
  - `runtime/flow-bootstrap/action-permissions.ts`: passes both tokens to the ledger.
  - `runtime/flow-bootstrap/site-reset/contracts.ts`, `ledger.ts`: the new tokens and the match rule.
  - `runtime/flow-bootstrap/site-reset/words.ts`, `runtime/service/project-build/brief-ports.ts`: one general sentence each. It tells the model to undo an effect where it shows on another page or in another list. It names no site.
  - `runtime/service/candidate-trial/landed-acts.ts`: trial steps carry both tokens.
  - Tests:
    - new: `site-reset/tests/ledger-subject.test.ts` (includes an add-to-cart trial act and acts with no reverse), `action-permissions/tests/declaration.test.ts`;
    - extended: `flow-bootstrap/tests/site-reset-calls.test.ts`, `service/candidate-trial/tests/landed-acts.test.ts`.
- **Extension** (`fxwork/t719/!FluxIQWebExtension`):
  - `shared/dom-element.ts`: new `context.subject` field.
  - `content/identity/record.ts`: new `recordSubject`. It fails closed when the nearest title sits in a neighbouring row of the same shape.
  - `content/identity/context.ts`, `content/describe-element.ts`: the subject is computed only for controls and headings.
  - Tests in `content/identity/tests/record.test.ts` and `context.test.ts`. `shared/tests/present.test.ts` gained the new key in its literals.
- **Domain**:
  - `llm-evidence/elements.ts`, `sanitize.ts`: the binding gains `subjects` and `pageSubject`.
  - `stable-handles.ts`, `capture.ts`, `structure/detect.ts`: carry them through.
  - `control-spot/target.ts`, `control-spot/token.ts`: the new `subject` token kind.
  - `permission.ts`, `node-run/run.ts`: the declaration carries the tokens.
  - `state-diff/places/snapshot.ts`, `diff.ts`: trial step spots carry them too.
  - Tests in `control-spot/tests/target.test.ts`, `declared.test.ts`, `state-diff/places/tests/places.test.ts`.

## Commands run and observed results

- **Fail-first:**
  - Core: the new ledger tests showed 5 failed and 5 passed before the fix; the declaration, wrapper and landed-acts tests showed 3 failed.
  - Domain: against the HEAD source, 3 new tests failed and 10 passed.
  - Extension: against the HEAD `record.ts`, the build failed because `recordSubject` was missing.
- **Core vitest** over `action-permissions`, `site-reset`, `site-reset-calls`, `landed-acts`, `service/project-build`, `candidate-trial`, `flow-bootstrap/tests` and `flow-bootstrap/candidate`: 836 passed, 1 failed.
  - The failure is `candidate/tests/refusal-locator-corpus.test.ts`: `flow_script.repeat_over_twice`.
  - It comes from commit cb765939, is not mine and touches none of my files. It was not run on an unchanged tree.
- `node scripts/build-cache/cli.mjs contracts:check fluxiq:check` → EXIT 0.
- Core `node scripts/structure-audit.mjs` → passed.
- `fluxiq:build` → EXIT 0. Core's dist was rebuilt so the downstream checks could see the new types.
- Domain `npm run check` → exit 0. Domain tests in `control-spot`, `places`, `sanitize`, `stable-handles`, `elements` and `press` → 80 passed, 0 failed.
- Extension `npm run check` → stamped (passed). Extension tests in `identity/record`, `identity/context` and `shared/present` → 52 + 8 passed, 0 failed.
- Downstream `node scripts/structure-audit.mjs` → passed.

## Not verified

- No live Lab run on everything-store. The rule is proved in unit tests only.
- On the real page, it is not proved that:
  - the detail page's `h1` words exactly equal the cart line's link words;
  - the lone saved line's "Move to cart" gets the line's title.
- Not checked at run time:
  - performance of the subject walk on large pages;
  - the reset model actually aiming its undo at the cart line.
- Full suites were not run.

## Open questions or contradictions found

- Residual risk: if a line of the same product existed before the build began, a subject match admits a Delete on it. That Delete is asked (`allowed: []`), never unasked, but it is still a risk.
- I did not touch the cart spans' missing item tokens (`isRowControl` rejecting `span`s with a tab stop). The subject path works around it. Fixing it would change replay identity gating, so it is a separate decision.
- Next step: the supervisor reviews and commits both repositories, then runs one everything-store live round to confirm the reset now removes the build's cart lines.
