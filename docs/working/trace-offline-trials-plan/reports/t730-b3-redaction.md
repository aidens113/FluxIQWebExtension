# t730-b3-redaction

## Outcome

Partial. 24 of the 30 original tests now run on bigbox-retail's checkout. One test, the multi-token autocomplete row, is covered by an existing unit test, so I removed its browser copy. Five tests are blocked: no realistic page has the construct they need, so they are unchanged and still open sensitive-input. I added three new realistic rows: a login-form selection, the card-label naming route, and an assertion that turning value capture off also withholds the email.

## What changed and why

Every realistic row uses bigbox-retail checkout, the only realistic site whose fields are sensitive under the shared rule (`isSensitiveFieldSignature`):

- **Sign-in wall** (consent declined through `/api/bigbox-retail/consent`, then `/checkout`). It has `input[name=password]` (`type=password`, `autocomplete=current-password`). The ordinary control is `input[name=email]` (`autocomplete=username`, which the rule does not treat as sensitive).
- **Guest checkout** (`start-guest-checkout`). The cross-origin frame `iframe[title="Secure card entry"]` holds `cardnumber` (`cc-number`) and `exp` (`cc-exp`). The ordinary controls are the top page's contact `email`, `firstName` and `h1` "Checkout".

The site pre-fills nothing. A "pre-filled" value is therefore written with Playwright `fill` before the recorder starts. Values used: `4242424242424242` (the public test card), `04/39`, `SYNTHETIC_PASSWORD_DO_NOT_USE` and `synthetic-*` strings.

The harness answers only through the top frame. Card rows therefore send messages to the frame's own runtime stub with `frameId: 1`, the same way `frames.spec.ts` does. The stub global name is written out locally because `harness.ts` does not export it. Recorded events and descriptors are matched by `attributes.name`, because the generated ids change with the seed. The helpers stay local to each spec, since I own no shared file.

| spec | test | capability | disposition | new home | headed run |
| --- | --- | --- | --- | --- | --- |
| redaction | no password value reaches any recorded message | recorder never sends a sensitive value, typed or present before recording; ordinary value still sent | Retarget | same file/name, sign-in wall | pass |
| redaction | key pressed in sensitive field recorded as press | keydown drops `key` for characters in sensitive control | Retarget | same, wall password | pass |
| redaction | recorded input event without value | `dom.input` keeps `hasValue`, drops value | Retarget | same, wall password | pass |
| redaction | snapshot reports presence, never value | snapshot descriptor redaction plus ordinary control | Retarget | same, wall | pass |
| redaction | action result evidence without value | action `element` descriptor redaction | Retarget | same, wall | pass |
| redaction | captureInputValues off withholds every value | capture setting withholds ordinary values | Retarget (+ whole-wire check) | same, wall email | pass |
| redaction | web.dom.type withholds text, reports match | type verb redacted validation | Retarget | same, wall password | pass |
| redaction | web.dom.clear withholds value | clear verb validation | Retarget (+ page value check) | same, wall password | pass |
| redaction | card field sensitive by shared rule | `cc-number` read through the rule on every path (snapshot, recorder, type) | Retarget | same, card frame | pass |
| redaction | non-sensitive field quotes validation | redaction is targeted | Retarget | same, wall email | pass |
| redaction | post-condition secret-free after domain hop | failure-record exit plus adapter guard, live mismatch | Retarget | same, card frame (rewrite listener staged in frame) | pass |
| redaction | declaration buys phrasing; other states withhold | `redacted` flag contract in `webAutomationActionResultPayload` | Retarget | same, card frame plus guest email control | pass |
| redaction | runtime adapter withholds undeclared failure record | adapter fail-safe, stamped and unstamped | Retarget | same, card frame | pass |
| redaction | multi-token autocomplete sensitive | rule splits autocomplete tokens | Unit (already exists) | `src/shared/tests/sensitive-field.test.ts` "every autocomplete token is checked, not only the whole value"; the DOM read (`element-traits.ts:96` passes the raw attribute) is covered by the card rows. Browser row removed. | n/a |
| selection-redaction | select-all inside card never reaches snapshot | focused-control selection withheld | Retarget (+ premise that the browser does report the digits) | same, card frame | pass |
| selection-redaction | ... never reaches a recorded snapshot | recorder-attached snapshot withheld | Retarget | same, card frame | pass |
| selection-redaction | selection touching no sensitive control survives | ordinary selection kept | Retarget | same, guest `main h1` "Checkout" | pass |
| selection-redaction | select-all in ordinary field survives | ordinary field selection kept | Retarget | same, guest First name | pass |
| selection-redaction | selection from outside the form into card | range-intersects-sensitive check (question 3) | Retarget | renamed "a selection that runs across the card form and over the card field is withheld", card frame | pass |
| selection-redaction | (new) heading to password range | question 3 where Chromium would not leak | New | "a selection that starts at the sign-in heading and runs over the password field is withheld" | pass |
| sensitive-names | (new) card label embeds field | accessible name/label/forms evidence must not include an embedded sensitive field's value | New realistic | "bigbox-retail: no name in page evidence quotes a card field through the label that embeds it" | pass |
| sensitive-names | no name quotes sensitive contents, whichever route | aria-labelledby / button text / landmark name routes skip sensitive content | Blocked | unchanged; hook below | pass (on sensitive-input) |
| sensitive-names | no context or label quotes sensitive contents | legend / heading / column header / label-for / nearby text skip sensitive spans | Blocked | unchanged; hook below | pass on rerun (timed out once under load) |
| sensitive-names | no descriptor carries state inside marked element | `data-sensitive` ancestor withholds checked/options/selectedValue | Blocked | unchanged; hook below | pass |
| sensitive-names | no recorded event carries state inside marked element | recorder applies ancestor marking to input/change/keydown | Blocked | unchanged; hook below | pass on rerun (timed out once under load) |
| extract-list-sensitive | field resolving to sensitive control refuses read | extract refuses sensitive targets | Retarget | same, card frame `form label` / `input@value` | pass |
| extract-list-sensitive | field inside sensitive control (option) refuses | option of a sensitive select is the control (D2) | Blocked | unchanged; hook below | pass (on sensitive-input) |
| extract-list-sensitive | text field skips sensitive contents | text reader skips sensitive textarea/select text | Blocked | unchanged; hook below | pass (on sensitive-input) |
| extract-list-sensitive | value field refuses sensitive, reads ordinary | value-kind field policy | Retarget | same, sign-in card `main div:has(> h1)` | pass |
| extract-list-sensitive | excluded field never read | `handling: "exclude"` (D12) | Retarget | same, sign-in card | pass |

**Hook the five blocked rows need.** No realistic site has a sensitive `<select>`, a sensitive `<textarea>`, a sensitive checkbox, or any `data-sensitive` markup. One armable bigbox-retail variant would unblock all five while leaving the default site unchanged: say `account-recovery` (`set-mode`), rendering a "Forgot password?" panel on the sign-in wall that contains:

1. A `data-sensitive` group holding:
   - a "Recovery phrase" text input;
   - a "Security answer" `<select>` with two options;
   - a "Remember this device" checkbox.
2. Next to that group, an ordinary "Preferences" group with the same three kinds of control.
3. A "Security question" control named through `aria-labelledby` by a span that holds a `<select autocomplete="one-time-code">`.
4. A hint button named by a span containing a `data-sensitive` textarea, plus a "Reveal" button whose text holds a `data-sensitive` span.
5. A "Saved cards" region whose landmark name, `<h2>`, fieldset legend and table column header each hold a `data-sensitive` span showing a masked number, with an unlabelled input next to a `data-sensitive` span.

The extract rows need items 1 and 4, wrapped in `<label>`s.

## Commands run and observed results

All runs were headed and provider-free, from the repo root.

- `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/redaction.spec.ts --headed --workers=2` -> `13 passed (1.9m)`
- `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/selection-redaction.spec.ts --headed --workers=2` -> `6 passed (1.3m)`
- `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/extraction/tests/extract-list-sensitive.spec.ts content/tests/evidence/tests/sensitive-names.spec.ts --headed --workers=2` -> `8 passed, 2 failed (3.3m)`. The two failures were the unchanged blocked sensitive-names rows, both `Test timeout of 30000ms exceeded`. Other rows in the same run took 17-19 s, so the machine was loaded.
- Rerun: `... test:content -- content/tests/evidence/tests/sensitive-names.spec.ts --headed --workers=2` -> `5 passed (2.4m)`.
- I changed the frame helper in extract-list-sensitive to fix a type error, then reran: `... test:content -- content/tests/extraction/tests/extract-list-sensitive.spec.ts --headed --workers=2` -> `5 passed (3.7m)`.
- Typecheck of only my four files and their imports: `npx tsc -p <scratchpad>/tsconfig.b3.json` (extends `apps/extension/tsconfig.test.json`, `files` = the four specs) -> 0 errors. The first attempt found TS2589 at extract-list-sensitive.spec.ts:81, which I fixed.
- `node scripts/structure-audit.mjs` -> 2 violations, neither in my files: `directory-files` in `src/content/extraction/tests/` (27 files, including two new untracked tests from another worker) and `statement-packing` in `identity.spec.ts`. My only entry is an advisory warning: redaction.spec.ts has 556 lines, over the 400-line threshold (it had 468).

## Not verified

- I did not run the whole-package typecheck or any full suite; the brief leaves those to the lead.
- No unit tests ran, because none were added.
- Firefox was not exercised. All runs were in the harness's Chromium.
- I did not check the CVC claim below in a browser. It is my reading of the rule's inputs.

## Open questions or contradictions found

- **Possible product gap.** bigbox's card frame has "Security code" as `input[name=cvc]`, with no `autocomplete` attribute. The shared rule looks only at `type`, `autocomplete` and `data-sensitive`, so it treats this field as ordinary. Its value would then be recorded and snapshotted. Real CVC fields often omit `cc-csc`. The rule may need a decision about name-based hints, which belongs in domain `sensitivity/`, not in this brief.
- The brief pointed at job-board ATS fields (email, tel, salary) and local-classifieds honeypots. None of them is sensitive under the shared rule, so they cannot prove redaction. I used them nowhere.
- The everything-store payment frame holds saved-card radios, which are also not sensitive under the rule, so I did not use it.
- The frame-messaging helper (the stub global plus a `frameId: 1` delivery) is now repeated in `frames.spec.ts` and in three of my specs. A `harness.frame(selector)` export from `harness.ts` would remove the duplication. I don't own that file.
