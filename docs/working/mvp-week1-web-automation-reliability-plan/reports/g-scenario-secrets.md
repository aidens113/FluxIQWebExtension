# g-scenario-secrets — realistic fixtures that type into sensitive controls

## Outcome

**Done for both scenarios.** A first pass stopped at `storefront-checkout`: the
brief named `sensitive-input/manifest.ts`, which does not exist. The supervisor
amended the brief ("Amended after a Partial") to add
`sensitive-input/scenario.ts` and its `tests/`, and I then applied the patch the
first pass had checked.

Since W18, a Flow-lane run fails `fixture.invalid` unless each request for a
run-time value pairs with exactly one declared secret. Both scenarios now pair.
This was checked with the Flow lane's real `declaredSecretBindingInputs`,
against requests built by the domain's own payload code. Each scenario has a
unit test that fails when a marked step has no secret, or an unmarked step has
one. Both mutations of each scenario were restored byte-identical.

**Re-verified at HEAD first. Neither item was settled.**

- **storefront-checkout** declared three secrets: card number, billing card
  number and account password. The sensitivity rule marks five of its typed
  controls, because `card-name` carries `autocomplete="cc-name"`
  (`payment-frame.ts:35`) and `card-expiry` carries `cc-exp`
  (`payment-frame.ts:39`). Every `cc-` token is sensitive
  (`domain/src/sensitivity/signature.ts:45-46,63-66`). The HEAD manifest
  therefore throws:
  > `Request web.secret.card-name (parameter text; answered by 0 declarations). Request web.secret.card-expiry (parameter text; answered by 0 declarations).`

  Its HEAD unit test passed anyway. It pinned those three steps and checked their
  markings, but never checked that no other typed field is marked.
- **sensitive-input** declared no secrets. Its password step targeted
  `role:textbox[name=Password]`, which can never pair. The recorder gives a
  password input no implicit ARIA role
  (`apps/extension/src/content/identity/implicit-role.ts:11-26,83-86`), and the
  content harness asserts `implicitRole` is undefined (`identity.spec.ts:190`).
  Pairing needs `role` or `implicitRole` to match
  (`packages/test-runner/src/flow-lane/declared-secrets.ts:179-181`). The
  recording lane works only because Playwright treats a password input as a
  textbox.

## What changed and why

### Which steps become requests

A request is written only for typed text (`web.dom.type`, `payloads.ts:47`), and
only when the control is marked. The rule marks a control when any of these
holds:

- `type` is `password`, `one-time-code` or `credit-card`;
- `data-sensitive="true"`;
- an `autocomplete` token is `current-password`, `new-password` or
  `one-time-code`, or starts with `cc-`.

Clicks, checks and waits never become requests.

**storefront-checkout typed steps**

| Step | Control and markings | Marked |
| --- | --- | --- |
| `enter-promotion` | `promo-code`, `autocomplete="off"` | no |
| `enter-name` | `address-name`, `name` | no |
| `enter-email` | `address-email`, `type=email`, `email` | no |
| `enter-postcode` | `postcode`, `postal-code` | no |
| `enter-account-password` | `account-password`, `type=password`, `new-password` | **yes** |
| `enter-card-number` | frame `card-number`, `cc-number` | **yes** |
| `enter-card-name` | frame `card-name`, `cc-name` | **yes** (missing at HEAD) |
| `enter-card-expiry` | frame `card-expiry`, `cc-exp` | **yes** (missing at HEAD) |
| `enter-security-code` | frame `card-security-code`, no autocomplete | no (deliberate trap) |
| `enter-billing-card-number` | frame `billing-card-number`, `billing cc-number` | **yes** |

**sensitive-input typed steps**

| Step | Control and markings | Marked |
| --- | --- | --- |
| `replace-password` | `password`, `type=password` | **yes** |
| `replace-payment` | `payment`, `cc-number` | **yes** |

`billing` (`billing cc-number`) is marked too, but no step types into it, so
nothing asks for it.

### `storefront-checkout/manifest.ts`

`secrets` now holds five declarations, in script order:

1. `storefront-checkout-password`
2. `storefront-checkout-card`
3. `storefront-checkout-card-name` (new)
4. `storefront-checkout-card-expiry` (new)
5. `storefront-checkout-billing-card`

The existing ids, and so their variable names, are unchanged. Every target is
`testid:` or `frame:Secure card payment/testid:`, the form `targetMatchesRequest`
pairs against the recorded `testId` (`describe-element.ts:71-72,170-175`). The
doc comment, which was wrong about "two values plus the password", now states
the rule, the one-to-one pairing, and why the security code stays undeclared.

### `sensitive-input/scenario.ts`

- `replace-password`'s target changed from `role:textbox[name=Password]` to
  `testid:password`. `data-testid="password"` is in the page markup.
- New declarations:
  `secrets: [{ id: "sensitive-input-password", step: "replace-password" }, { id: "sensitive-input-payment", step: "replace-payment" }]`.
  A short comment explains why the password step targets its test id.

Before changing the target, I searched `apps/scenario-lab` and `apps/extension/e2e`
for `textbox[name=Password]`, `role:textbox`, `replace-password` and
`name=Password`. The only match was `sensitive-input/scenario.ts:13`, the line
changed. An earlier whole-repository search, excluding docs and build output,
also found no other reader. The expected counts are unchanged: two
`input_changed` events and one `clicked`.

### Tests

Both tests are named "a secret is declared for exactly the steps that type into
a marked control, each one pairable by its test id".

**`storefront-checkout/tests/scenario.test.ts`** replaces the old "a secret is
declared for every marked sensitive field…". It:

- finds each step's form control in the rendered top document or card frame, and
  classifies it by the rule's markings;
- asserts that every marked step is a `type` step, and pins the marked steps by
  name;
- asserts that the declared steps equal exactly that list;
- asserts each target is a `testid:` target, that no two name the same control,
  and that each secret has its own variable;
- asserts the security code is unmarked.

**`sensitive-input/tests/scenario.test.ts`** is a new file with two tests:

- **manifest is valid:** `validateWebScenario` accepts it.
- **the pairing test:** the same checks against the rendered page, with the
  marked steps pinned as `["replace-password", "replace-payment"]`. It also
  requires every typed step to name its control by test id, so reverting to a
  role target fails too. It asserts the `billing` field is marked and that no
  step types into it.

Both test files restate the rule's markings, because scenario-lab cannot import
the domain (*Open questions* 1). Pinning the step names makes a drift fail
instead of passing silently.

## Commands run and observed results

Commands ran one at a time. Exit codes came from `$LASTEXITCODE` with output
redirected to a file, not through a pipe. Each result was observed once. None
was uniform or impossible, so none was rerun.

**How the tests were run.** The package `test` script builds into the shared
`apps/scenario-lab/dist/`, and another worker is editing scenario-lab tests at
the same time. So I ran that script's two steps into a directory only I used:
`FLUXIQ_LAB_SCENARIO_OUT_DIR=apps/scenario-lab/.script-build/g-scenario-secrets node apps/scenario-lab/scripts/build-scenario-lab.mjs`,
then `node --test "<that dir>/**/*.test.js"`.

| Command | Observed |
| --- | --- |
| `pnpm --dir apps/scenario-lab check` (storefront pass) | exit 0 |
| Build and full test run (storefront pass, after edits and after restores) | build exit 0; `# tests 197`, `# pass 197`, `# fail 0`, `# cancelled 0` |
| `pnpm --dir apps/scenario-lab check` (sensitive-input, after edits) | exit 0 |
| Build and full test run (sensitive-input, after edits) | build exit 0; `# tests 199`, `# pass 199`, `# fail 0`, `# cancelled 0` |
| **Final** `pnpm --dir apps/scenario-lab check` after every restore | exit 0 |
| **Final** build and full test run after every restore | build exit 0; `# tests 199`, `# pass 199`, `# fail 0`, `# cancelled 0` |
| `pnpm --dir packages/test-runner exec tsc -p tsconfig.json --outDir .g-scenario-secrets/dist` (twice) | exit 0 both times. Each time I first confirmed `declared-secrets.ts` held no `if (false &&`. |
| Pairing check against the restored tree (below) | exit 0 |
| `node scripts/structure-audit.mjs`, with the new test staged in a scratch `GIT_INDEX_FILE` | exit 1. The only FAIL is `[working-docs] docs/working/README.md is out of date with the documents' header blocks`, a shared doc I don't own. No line names `sensitive-input` or `storefront-checkout`. |
| Removed `packages/test-runner/.g-scenario-secrets` and `apps/scenario-lab/.script-build` | `exists=False` for both |

Line counts: storefront `manifest.ts` 171 and `tests/scenario.test.ts` 316;
sensitive-input `scenario.ts` 58 and `tests/scenario.test.ts` 55. None is in
`.structure-baseline.json`.

Two combined final commands were blocked by the permission check, with
"Remove-Item on system path … is blocked". Nothing in them ran. I reran the same
steps as separate commands, which are the ones quoted above.

### Mutation proofs

Each mutation was rebuilt and its scenario's test file run, then undone with the
inverse edit and the file hashed again.

| # | File | Mutation | Failing test, quoted | Restored SHA-256 |
| --- | --- | --- | --- | --- |
| M1 | storefront `manifest.ts` | removed the `enter-card-name` declaration | `not ok 2 - a secret is declared for exactly the steps…` / `-   'enter-card-name',` (17 of 18 passed) | `514C135E…0C606`, identical |
| M2 | storefront `manifest.ts` | declared unmarked `enter-security-code` | `not ok 2 - …` / `+   'enter-security-code',` (17 of 18 passed) | `514C135E…0C606`, identical |
| SA | sensitive-input `scenario.ts` | removed the `replace-payment` declaration | `not ok 2 - …` / `one declaration per marked step, and none for any other` / `-   'replace-payment'` (1 of 2 passed) | `54ADA6C5…F384D518`, identical |
| SB | sensitive-input `scenario.ts` | declared unmarked `submit-sensitive` | `not ok 2 - …` / `one declaration per marked step, and none for any other` / `+   'submit-sensitive'` (1 of 2 passed) | `54ADA6C5…F384D518`, identical |

Full hashes: storefront
`514C135E10E521480AF8C364A59CEDBCB016A0FD7A493CCCBF68E6B8C0D0C606`;
sensitive-input
`54ADA6C554B528585942B600CA90649B843495C745FA7DD0439C36A7F384D518`.
Both were taken after my edits and before mutating.

### Pairing check with the real code

The scratch script is
`C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\4f264c80-323b-4673-a09a-bde5851669f3\scratchpad\g-scenario-secrets-pairing.mjs`,
which may not outlive the session. For each typed step it does this:

1. Builds a descriptor from the rendered markup, shaped like the ones
   `describe-element.ts` writes. Password fields get no implicit role, and
   sensitive-input's labels are the ones the harness observed at
   `identity.spec.ts:185-197`.
2. Leaves `inputValue` out for marked controls, as the recorder does.
3. Builds the node's parameters with the domain's
   `webAutomationOutputPayload("web.dom.type", …)`, and reads the requests with
   `webAutomationUnresolvedSecretParameters`.
4. Pairs them using the compiled test-runner's `declaredSecretBindingInputs`.

Values are placeholders, and only paths and secret ids are printed. Observed on
the final restored tree:

```text
storefront manifest as written: PAIRED {"web.secret.account-password":"storefront-checkout-password","web.secret.card-number":"storefront-checkout-card","web.secret.card-name":"storefront-checkout-card-name","web.secret.card-expiry":"storefront-checkout-card-expiry","web.secret.billing-card-number":"storefront-checkout-billing-card"}
storefront with only the original three: THREW RunnerFailure: … Request web.secret.card-name (parameter text; answered by 0 declarations). Request web.secret.card-expiry (parameter text; answered by 0 declarations).
sensitive-input declared: [["sensitive-input-password","replace-password","testid:password"],["sensitive-input-payment","replace-payment","testid:payment"]]
sensitive-input manifest as written: PAIRED {"web.secret.password":"sensitive-input-password","web.secret.payment":"sensitive-input-payment"}
sensitive-input with the old role:textbox[name=Password] target: THREW RunnerFailure: … Request web.secret.password (parameter text; answered by 0 declarations). Declaration sensitive-input-password for the step replace-password (paired with 0 requests).
```

## Not verified

- **No Lab run**, since the brief forbids `pnpm lab`. These Flow-lane commands
  must now get past pairing (the `run … --flow --variant --target` form is from
  `commands.ts:34-43`; I did not execute it):
  - **storefront-checkout:**
    `FLUXIQ_TEST_ENV_FILES=none pnpm lab run storefront-checkout --flow --target isolated`,
    and again with `--variant declined-card`. These must be set and non-empty:
    - `FLUXIQ_TEST_SECRET_STOREFRONT_CHECKOUT_PASSWORD`
    - `FLUXIQ_TEST_SECRET_STOREFRONT_CHECKOUT_CARD`
    - `FLUXIQ_TEST_SECRET_STOREFRONT_CHECKOUT_CARD_NAME`
    - `FLUXIQ_TEST_SECRET_STOREFRONT_CHECKOUT_CARD_EXPIRY`
    - `FLUXIQ_TEST_SECRET_STOREFRONT_CHECKOUT_BILLING_CARD`

    Any non-empty value works: the frame only checks that fields are non-empty
    (`payment-frame.ts:98-99`) and never sends the digits.
  - **sensitive-input:**
    `FLUXIQ_TEST_ENV_FILES=none pnpm lab run sensitive-input --flow --target isolated`,
    with `FLUXIQ_TEST_SECRET_SENSITIVE_INPUT_PASSWORD` and
    `FLUXIQ_TEST_SECRET_SENSITIVE_INPUT_PAYMENT` set.
- **What those Lab runs must show:**
  1. No `fixture.invalid` pairing failure, and no `environment.missing`.
  2. The approved Flow has one request node per marked control: five for
     storefront, two for sensitive-input.
  3. Each of those `web.dom.type` attempts `succeeded`, with no
     `web.intervention.required` rejection.
  4. The final-state facts pass: storefront's `order-confirmed`,
     `order-reference-issued` and `paid-with-delivery`, with `declined-card`
     still reporting `unexpected_state`; sensitive-input's `secrets-discarded`.
  5. No supplied value appears in any trace, run history, evidence packet or log.
  6. sensitive-input's recording lane still records two `input_changed` events
     with `testid:password` as the target.
- **Live assumptions not observed:**
  - That controls inside the card frame are recorded with `testId`. The code sets
    it regardless of frame.
  - That a live recording's path keys stay distinct. A live key may come from the
    snapshot state id first (`secret-binding.ts:115-117`). Pairing matches by
    control, not by path spelling. But if two controls shared a state id, their
    requests would share one path and pairing would fail.
- **`domain/dist` is out of date.** It lacks the gate at `input-model.ts:178`, so
  the pairing check calls `webAutomationOutputPayload` directly and skips that
  gate. `f-w18-secret-leg` proved the gate by unit test. The requests were built
  from markup, not from a live recording.
- **Not run:** the scenario-lab Playwright e2e (`test:e2e`), the extension content
  harness, root `pnpm check`, `pnpm test` and `pnpm build`. No content-script or
  extension file changed. I did not survey scenarios beyond these two.

## Open questions or contradictions found

1. **The sensitivity rule is restated in two test files.** scenario-lab depends
   only on test-contracts (`apps/scenario-lab/package.json`, and the `paths` in
   `tsconfig.json`), so the tests cannot import `isSensitiveFieldSignature`.
   Pinning the step names catches drift in these fixtures, but the rule's
   markings now exist in two test helpers. The mechanical fix is to add
   `@fluxiq-web-extension/domain` to scenario-lab's dependencies and tsconfig
   `paths`, then import the rule into a shared helper under
   `apps/scenario-lab/src/scenarios/tests/`. That touches `package.json`,
   `tsconfig.json` and `pnpm-lock.yaml`, none of which are mine.
2. **Brief defect, now fixed.** The original brief named a `sensitive-input/manifest.ts`
   that does not exist; the manifest is inline in `scenario.ts`. The amendment
   resolved it. I kept the manifest inline rather than extracting it, to keep the
   change to what was verified.
3. **Structure audit.** It fails only on `docs/working/README.md` being out of
   date, which is not my file. No baseline entry needs to change.
