# fix-witness-ambiguity

Outcome: Done. The test was stale; the product is correct.

## Which side was wrong
In lineage.test.ts the "two actual pre-act sources" test acted the same control (#workspace-open) from two pages. Both
witnesses carry the same control intent (neutral), so lane B's commit 175acd38f correctly resolves them. The commit's own
unit test ("two acted sources that disagree stay ambiguous", control-intents/tests/resolution.test.ts) already proves
disagreeing witnesses still refuse, so no regression in absolute.ts.

## What changed (only domain/src/runtime/llm-evidence/tests/control-intent/tests/lineage.test.ts)
- Old test rewritten to assert completion ok:true when the witnesses agree.
- New test: two sources whose witnesses disagree (page 1 has an open consent dialog and the link reads "Accept all",
  page 2 has no dialog) still refuse with `web.handle.ambiguous` through public completion; 2 acts, none extra.
- lineageHost gained `consentOnFirstPage` option, built without object spreads (structure audit contract-spread rule).

## Validation
- `node scripts/test-domain.mjs runtime/llm-evidence output-nodes/extract-list` (domain/) -> 1748 tests, 1748 pass, 0 fail
  (run before a last typing-only tweak; lineage file re-run after: 3 pass, 0 fail).
- `pnpm run check` (domain) -> exit 0 (first attempt caught `parent: undefined` not a JsonValue; fixed).
- `node scripts/structure-audit.mjs` -> "passed (244 warning(s), 552 baselined)".

## Not verified
Full llm-evidence suite not re-run after the final typing tweak (only the lineage file).
