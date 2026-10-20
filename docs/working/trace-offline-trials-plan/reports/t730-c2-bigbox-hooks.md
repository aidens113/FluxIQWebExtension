# t730-c2-bigbox-hooks

## Outcome

Done. bigbox-retail has a new armable rendering, `account-recovery`. It opens a "Forgot your password?" panel beside the checkout's sign-in wall. The default site does not change.

The seven blocked rows now run on that panel and pass headed:

- 4 in sensitive-names
- 2 in extract-list-sensitive
- 1 in identity-signals

None of the three spec files opens a synthetic scenario any more.

B3's CVC suspicion is **confirmed** by a headed probe. The card frame's "Security code" value reaches the snapshot, every recorded keydown and the recorded `dom.input`. Details are under Open questions. No `src/` was changed.

## What changed and why

### Scenario (`apps/scenario-lab/src/scenarios/bigbox-retail/`)

- **`types.ts`**: added `"account-recovery"` to `bigboxModes`, with a doc entry. It is armed through the existing `set-mode` operation, which starts the shopper over like every other arm.
  - No manifest variant was added. Specs arm it directly, as `identity-fixtures.armMode` does for the other modes. So the manifest's variant list, the live tasks and the repair tasks are untouched.
- **`pages/account-recovery/`** (new directory: `panel.ts`, `values.ts`, `index.ts`).
  - `values.ts` exports `ACCOUNT_RECOVERY_VALUES`: every value the page itself marks hidden. Specs import it through the scenario barrel and search the whole wire for all of them.
  - `panel.ts` renders one unnamed `<form>` inside a `<section aria-labelledby>` headed "Forgot your password?". It has four parts:
    1. **"Your security details"**: a `div[data-sensitive]` holding a text field (`recoveryPhrase`), a select (`securityAnswer`, 2 options) and a checkbox that starts ticked (`rememberDevice`). None of the three is marked itself.
    2. **"Contact preferences"**: an ordinary `<fieldset>` holding the same three kinds of control (`preferredName`, `callTime` Mornings/Evenings, `accountEmails` ticked). It has a different shape from part 1, so the two do not read as one repeating run.
    3. **`role=group` "Confirm it's you"**, which holds:
       - a `<label id>` "Password hint" wrapping a `data-sensitive` textarea;
       - a `<label id>` "Verification code" wrapping a `<select autocomplete="one-time-code">`;
       - a `<label id>` "Send codes by" wrapping an ordinary select.

       Each label names a button beside it through `aria-labelledby` (`showHint`, `useCode`, `changeChannel`). The group also has an "Email a reset link to `<span data-sensitive>`…" button (`emailResetLink`).
    4. **"Saved cards"**: a `<section aria-labelledby>` whose `<h3>` holds a `data-sensitive` masked card. Inside it:
       - a table column header "Card `<ds>`" with a Remove button;
       - a fieldset legend "Billing address on file `<ds>`";
       - a `<label for>` "Nickname for `<ds>`";
       - "Billing ZIP code" text, a `<ds>` span and then an unlabelled input;
       - a Save button.
  - The page text uses no test vocabulary, and all values are made up. A unit test checks that the visible text matches none of: synthetic, fixture, secret, sensitive, test, planted, scenario. Controls carry `name` attributes, so specs find them without relying on seed-generated ids.
- **`pages/checkout-page.ts`**: only in this mode, the sign-in wall gains a `wallStack` class and the panel after its card. The panel sits outside `wallCard`, so the wall script's `card.querySelector('button')` and `one(C.btnLink, card)` still find Continue and the guest link. The guest checkout is unchanged.
- **`theme/theme.ts`, `theme/stylesheet.ts`**: 5 new class roles and their rules. Class names hash per role, so every existing class name is unchanged.
- **Barrels**: `pages/index.ts` and `index.ts` export `ACCOUNT_RECOVERY_VALUES` (`pages/index.ts` also exports `accountRecoveryPanel`).
- **`tests/account-recovery.test.ts`** (new, 6 tests). It covers several subjects (state, route and pages), so it sits in the scenario's own `tests/`. It checks:
  - arming through `set-mode`, which resets the shopper, and that the default is baseline;
  - the baseline wall carries no panel, no `data-sensitive` and none of the values;
  - the guest checkout is byte-identical across the two modes, and the wall keeps the baseline's class names;
  - the structure of the marked and ordinary groups;
  - each name, context and label route in the markup, and that each `aria-labelledby` target is unique;
  - each value appears exactly once, the page has no test vocabulary, it has one unnamed form, and all 6 buttons are `type=button`.

### Specs (`apps/extension/e2e/content/tests/`)

- **`evidence/tests/sensitive-names.spec.ts`**:
  - The four blocked rows now use a local `openAccountRecovery`, which arms the mode, declines consent and opens `/checkout`.
  - Descriptors are matched by `attributes.name`, and form controls by `name`.
  - Every row searches for all of `ACCOUNT_RECOVERY_VALUES`.
  - The header comment and imports were updated; the `sensitive-input` import is gone.
- **`extraction/tests/extract-list-sensitive.spec.ts`**: the two blocked rows now run on the panel. The option row reads the code select's label and options. The text row reads the three "Confirm it's you" labels.
- **`identity-signals.spec.ts`**:
  - The synthetic `TOGGLES` markup and the `ambiguous-targets` opener are replaced by `openAccountRecovery`, which uses `labMutate` and `openPath` from `identity-fixtures`.
  - `describeInSnapshot` now finds a control by its `name`.
  - The landmark expectation is now `region` / "Forgot your password?" (it was `navigation` / "Account").

| spec | test | new home | headed result |
| --- | --- | --- | --- |
| sensitive-names | no name in page evidence quotes a sensitive control's contents, whichever route computes it | bigbox-retail `account-recovery` wall: hint/code/channel labels naming buttons, reset-link button text, "Saved cards" region | pass (×2 runs) |
| sensitive-names | no descriptor's context or label quotes a sensitive control's contents | same; Saved cards legend / heading / column header / label-for / nearby text | pass (×2) |
| sensitive-names | no descriptor carries the checked state, options or selection of a control inside a marked element | same; "Your security details" group vs "Contact preferences" | pass (×2) |
| sensitive-names | no recorded event carries the value, checked state or options of a control inside a marked element | same groups, typed and toggled live | pass (×2) |
| extract-list-sensitive | a field that resolves inside a sensitive control, such as one of its options, refuses the whole read | same; `select[autocomplete=one-time-code]` in "Verification code" label | pass (×2) |
| extract-list-sensitive | a text field skips the contents of sensitive controls inside it | same; "Confirm it's you" labels → `Password hint`, `Verification code`, `Send codes by Text message` | pass (×2) |
| identity-signals | a sensitive checkbox is described without its state, and its toggle never becomes a guessed check | same; `rememberDevice` in the marked group, inside region "Forgot your password?" | pass (×2) |

The test names lost their `sensitive-input:` prefix and now start `bigbox-retail:`. The extract describe block is now "on bigbox-retail's account-recovery panel".

## Commands run and observed results

- `node ../../scripts/build-cache/cli.mjs scenario-lab:build -- "node scripts/build-scenario-lab.mjs"` (from `apps/scenario-lab`). It built twice, once before and once after moving the panel into its own directory. The second run printed `"build-cache":"build" … stored in the shared store (1076 file(s))`.
- Non-browser bigbox tests:
  - Command: `node --test dist/scenarios/bigbox-retail/tests/account-recovery.test.js …/scenario.test.js …/person-check.test.js …/store-remembered.test.js dist/scenarios/bigbox-retail/qualification/tests/*.test.js`
  - Result, both builds: `# tests 44 # pass 44 # fail 0`. That is the 6 new tests plus 38 existing ones; the manifest/variants test is among them and still passes.
- Browser bigbox tests:
  - Command: `node --test dist/scenarios/bigbox-retail/tests/browser-paths.test.js dist/scenarios/bigbox-retail/tests/breadth-browser-paths.test.js`
  - Result: `# tests 24 # pass 24 # fail 0`.
- Narrow typecheck:
  - Command: `npx tsc -p <scratchpad>/tsconfig.c2.json`, which extends `apps/extension/tsconfig.test.json` and lists the 3 spec files.
  - Result: exit 0 with no output, both before and after the directory move.
- Headed specs:
  - Command: `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/evidence/tests/sensitive-names.spec.ts content/tests/extraction/tests/extract-list-sensitive.spec.ts content/tests/identity-signals.spec.ts --headed --workers=2 --reporter=list --output=test-results/content/c2-artifacts`
  - Result: `14 passed (3.5m)` on the first run, and `14 passed (3.5m)` again after the directory move.
- CVC probe:
  - What ran: a temporary test appended to sensitive-names, run with `-g "c2 probe" --headed --workers=1`, then removed. The spec was restored from a copy and confirmed identical with `diff -q`.
  - Result: `1 passed`. Its output is quoted under Open questions.
- `node scripts/structure-audit.mjs` exited 1 with one violation, and it is not in my files: `[statement-packing] apps/extension/e2e/content/tests/large-page-resolution.spec.ts` lines 102 and 109.
  - My first layout raised an advisory warning: `pages/` had 16 files.
  - The two `account-recovery-*` files shared a prefix, so they moved into `pages/account-recovery/`. That cleared the warning.

## Not verified

- No whole-package typecheck, `pnpm check` or full suite. Only Chromium (the content harness) was run; Firefox was not.
- `apps/scenario-lab/dist/scenarios/bigbox-retail/pages/` still holds stale `account-recovery-panel.js` and `account-recovery-values.js` from the first build. The build does not clean old outputs. Nothing imports them, dist is ignored, and I did not hand-delete generated output.
- The panel is rendered without a click on a "Forgot password?" link: it is open from the start in this mode. No live or Lab task uses the mode.
- I did not run `pnpm structure:baseline`. The audit says one baseline entry can be lowered, but that entry is not mine.

## Open questions or contradictions found

1. **The CVC field leaks: confirmed.** bigbox's card frame has `<input name="cvc" inputmode="numeric">` with no `autocomplete`. I typed `7391` into it with recording on, pressed Tab, then took a snapshot. Observed:
   - `snapshotCvc: {value: "7391", hasValue: true, attributes: {name: "cvc", inputmode: "numeric"}}`. For contrast, the empty `cc-number` field carries no `value`.
   - Forms evidence: `{controlType: "text", name: "cvc", label: "Security code", hasValue: true}`. It has no `sensitive` flag.
   - Recorded events:
     - `dom.keydown` with `key` `7`, `3`, `9`, `1`, each with `element.value` growing (`""`, `"7"`, `"73"`, `"739"`);
     - `dom.input` with `inputValue: "7391"` and `element.value: "7391"`;
     - the Tab keydown with `element.value: "7391"`.
   - `wireHasCode: true`.

   The shared rule (`domain/src/sensitivity/signature.ts`) reads only `type`, `autocomplete` and `data-sensitive`, so it treats the field as ordinary. Real card forms often omit `cc-csc`. Whether the rule should use name or label hints (cvc, cvv, csc, "Security code") is a product decision for domain `sensitivity/`. The alternative is to treat it as fixture realism and leave it alone. Not fixed, as the brief asked.
2. **A group-marked control is invisible to the domain-side rule.** The identity-signals row now uses a checkbox that sits inside a marked group but is not marked itself. The content script withholds its `checked` (the row passes at every hop). But the wire descriptor carries no `data-sensitive`, so `isSensitiveElementDescriptor` downstream cannot tell this control is sensitive; only the content-side withholding protects it. The original B-1 row marked the checkbox itself, so the domain could see it. If the self-marked browser path should stay covered too, a `data-sensitive` checkbox could be added to the panel. I kept to the brief's suggestion that B-1's checkbox use the group.
3. `ACCOUNT_RECOVERY_VALUES` is exported from the bigbox barrel for the specs. Two specs and the identity spec each still have a local `openAccountRecovery`, because I own no shared helper file. A `harness`-level or fixture-level helper would remove the duplication.
