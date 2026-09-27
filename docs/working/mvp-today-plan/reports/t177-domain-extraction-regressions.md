# t177 — Domain extraction regressions

## Outcome

Done. Both stable failures were stale assertions, not production regressions.
No production code changed.

The new extraction matcher resolves `title` to `product-name` as a nearest
candidate with score `0.497`, above Core's measured `0.25` floor. That is a
plausible vocabulary match and is the intended defensive behavior: ordinary
instruction wording should resolve instead of being refused for not repeating
a detected key verbatim. The same stale `title` assumption appeared once in
the unit-level matcher test and once through the resolved-slot path.

The assertions now use names that the integrated matcher actually measures as
having no plausible candidate. Honest unresolved-column rejection remains
covered in both layers: `banana` (and `wombat` in the matcher test) is refused
as `web.handle.unknown_field`, while a `column:Name` request is still refused
when the detection exposes no headers. Malformed selector-like input remains
refused as well.

## Files changed

- `domain/src/runtime/llm-evidence/plan-resolution/extraction/tests/column-match.test.ts`
- `domain/src/runtime/llm-evidence/plan-resolution/extraction/tests/slot.test.ts`
- This report.

## Validation

From `F:/!FluxIQWebExtension`:

```text
$env:DOMAIN_TEST_BUILD_LABEL='t177-verify'
pnpm --filter @fluxiq-web-extension/domain test
```

Result: **847 tests passed, 0 failed**.

The two freshly built focused entries were then run directly:

```text
node domain/.test-build-scratch/t177-verify/runtime/llm-evidence/plan-resolution/extraction/tests/column-match.test.mjs
node domain/.test-build-scratch/t177-verify/runtime/llm-evidence/plan-resolution/extraction/tests/slot.test.mjs
```

Result: **2 files passed, 14 tests passed, 0 failed**.

`git diff --check` on both owned test files passed.

## Not verified

- No package outside `domain` was tested or built.
- No browser, Lab, provider, or live scenario run was performed.
- No commit or push was made.

## Open questions

None for this brief.
