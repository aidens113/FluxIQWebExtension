# t733-u2: group-sensitive marker on the wire descriptor

## Outcome

Partial. All four requested changes are in and their tests pass. The extension's `tsconfig.json` and `tsconfig.test.json` typechecks now fail in two files I do not own. Each failure is a compile-time guard doing its job, because the new descriptor field has to be either carried across the client gateway or excluded from it on purpose. I recommend carrying it (see Open questions 1). Per the brief, I stopped here instead of editing those files.

## What changed and why

- `apps/extension/src/shared/dom-element.ts`: added `sensitive?: true | undefined` to `DomElementDescriptor`, placed after `checked`. Its comment says the element "is, or sits inside, a control the shared sensitivity rule marks". It is present only when true. It is a separate marker rather than a written `data-sensitive`, because saved fingerprints and selectors read `attributes`.
- `apps/extension/src/content/describe-element.ts`: one line, `if (isWithinSensitiveControl(element)) descriptor.sensitive = true;`. In every other case the key is absent.
- `domain/src/sensitivity/descriptor.ts`: `dataSensitive` is now `"true"` when `record.sensitive === true`, and otherwise the attribute as before. Only the literal boolean `true` counts. The string `"true"` and `false` are ignored.
- `apps/extension/src/content/identity/accessible-name.ts`: `buttonValueName` now asks `isWithinSensitiveControl(element)` where it asked the self-only `isSensitiveFormControl`. I updated the header comment and the function's doc comment to match. The `isSensitiveFormControl` import is still used at line ~160.
- Tests:
  - `domain/src/sensitivity/tests/descriptor.test.ts`: a new row for the marker alone, the signature mapping, and the non-boolean and false values.
  - `apps/extension/src/content/tests/describe-element.test.ts`: a field inside a `data-sensitive` div gets `sensitive: true` and no value; an ordinary field has no `sensitive` key.
  - `apps/extension/src/content/identity/tests/accessible-name.test.ts`: a submit input inside a marked group has no name; an ordinary one is still named "Continue".

## Commands run and observed results

Test-first (before the source changes):

- `cd domain && DOMAIN_TEST_BUILD_LABEL=t733u2 node scripts/test-domain.mjs sensitivity/tests` printed `not ok 11 - a descriptor the content side marks sensitive is sensitive...`, then `# tests 27 # pass 26 # fail 1`.
- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t733u2 node scripts/test-extension.mjs src/content/tests/describe-element.test.ts src/content/identity/tests/accessible-name.test.ts` printed:
  - `not ok 8 - a push-button input inside a marked group takes no name from its value...`, where the actual value was the synthetic button value;
  - `not ok 10 - a control inside a marked group is described as sensitive...`, with `+ undefined` against expected `true`;
  - `# tests 27 # pass 25 # fail 2`.

After the changes:

- The same domain command printed `# tests 27 # pass 27 # fail 0`.
- The extension command, with `src/shared/tests` added, printed `# tests 58 # pass 58 # fail 0`.
- `domain: npx tsc --noEmit -p tsconfig.json` and `-p tsconfig.test.json` printed no errors.
- `apps/extension: npx tsc --noEmit -p tsconfig.json` printed one error, in a file I do not own:
  - `src/background/connection/gateway-payloads.ts(137,37): error TS2345 ... Property 'sensitive' is missing ... in type 'OptionalFields<WireElementTarget>'`.
- `apps/extension: npx tsc --noEmit -p tsconfig.test.json` printed that same error plus one more, also in a file I do not own:
  - `src/background/connection/tests/gateway-payloads.test.ts(129,44): error TS2344: Type '"sensitive"' does not satisfy the constraint 'never'.`
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (211 warning(s), 625 baselined).` The only line touching my files is the existing exported-values warning on `describe-element.ts`; I added no exports.

## Not verified

- No browser run and no full suites, as the brief required.
- The gateway path carrying `sensitive` end to end, since that would need the unowned edit below.
- `runtime-status.ts` behaviour (see Open questions 2).

## Open questions or contradictions found

1. **The client-gateway element target needs the field. Two unowned files are involved.**
   - `WireElementTarget` is defined as the descriptor minus `UnwiredElementField`. A new field therefore has to be either carried by `elementTarget` or named in that exclusion list.
   - I recommend carrying it. Core stores the wire target, and `domain/src/element-fingerprint/from-descriptor.ts` builds `secret: isSensitiveElementDescriptor(descriptor)` from it. `domain/src/recording/reducers.ts` and `action-target.ts` ask the same question. Dropping the marker at the gateway would hide group sensitivity again on exactly the stored path.
   - The exact edits:
     - `apps/extension/src/background/connection/gateway-payloads.ts`, in `elementTarget`, add `sensitive: element.sensitive,` (for example after `checked`). It is author-side structure, not contents, so it is kept for a secret control.
     - `apps/extension/src/background/connection/tests/gateway-payloads.test.ts`, line ~124, add `"sensitive"` to `WIRE_ELEMENT_FIELDS`.
   - The alternative is to add `"sensitive"` to `UnwiredElementField` in `dom-element.ts`, which is my file. That would compile, but the marker would not survive into stored targets. I did not choose it.
2. **`apps/extension/src/background/connection/runtime-status.ts:169` (not owned)** has its own `isSensitiveElementDescriptor`, which reads only `inputType`, `autocomplete` and `data-sensitive`. It ignores names, labels and the new marker. It should import the domain's `isSensitiveElementDescriptor`, as t732 Open question 4 already says.
3. **Other key-by-key consumers I checked:**
   - `domain/src/runtime/llm-evidence/elements.ts:249` spreads `raw` into the rule, so the marker reaches it as is.
   - `domain/src/recording/web-state/{action-target,state-values}.ts`, `look-alikes.ts` and `packet-fingerprint/from-packet.ts` build their own projections. They ask the rule of the original descriptor rather than copying a sensitivity field, so they need no change. `from-packet.ts` still has the gap t732 noted (no names or labels).
   - No other descriptor enumeration failed to compile in the domain.
