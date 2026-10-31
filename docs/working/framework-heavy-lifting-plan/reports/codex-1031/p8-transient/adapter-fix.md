# t826 adapter acceptance follow-up — source frozen

Outcome: Done for the three owned paths; domain check exposes three test-only errors outside this brief.

Changed:
- `domain/src/runtime/adapter.ts`
- `domain/src/runtime/tests/adapter.test.ts`
- `domain/src/runtime/tests/adapter-redaction.test.ts`

## Repairs

- Exact optional `expected`/`actual` assignments now screen first, delete absent properties on the parsed clone, and assign only an actual string when present. Existing withheld markers, digest logic, raw source identity, strict original precedence and transient admission remain unchanged. Updated adjacent adapter comments to describe generic-original precedence and fallback scope correctly.
- The two unknown-code tests preserve strict original code/category/retryability/stage and comparisons, with the sensitive case still proving the sentinel absent from the entire runtime result and no source mutation.
- Category-versus-code test now proves a familiar code cannot override the original category, stage or explicit nonretryability. Original source remains unchanged and gains no transient/certainty.
- Positive NO_EFFECT fixture explicitly supplies producer `effect:unacted` and `certainNoEffect:true`. A separate legacy code-only case proves cautious ambiguity and absence of certainty. The test's later formerly unreachable assertion now also preserves explicit valid generic positive controls on a broader code, rather than incorrectly assigning certainty ownership to the browser code table. No implementation policy change was made for any test expectation.
- Added distinct invalid unknown-code fallback coverage preserving old UNKNOWN diagnostics and screening sensitive comparisons, with no transient/certainty admission. Existing malformed temporary-record fallback test remains.

## Validation

Initial named command under `DOMAIN_TEST_BUILD_LABEL=t826-adapter-fix`:
`pnpm.cmd --filter @fluxiq-web-extension/domain test runtime/tests/adapter runtime/tests/adapter-redaction`
→ 72 tests, 71 pass / 1 fail. All four lead-reported legacy failures were resolved; the only failure was the positive NO_EFFECT test's later old assertion expecting explicit `certainNoEffect:true` to disappear for a broader code. Corrected that assertion to preserve the valid original controls.

Final same named command and label → exit 0; 72 tests / 72 pass / 0 fail / 0 skipped. Existing runner uses filename prefixes, so sibling adapter-prefix tests were included. Core build guard reported current source/build.

`pnpm.cmd --filter @fluxiq-web-extension/domain check`
→ exit 1 (inner tsc exit 2). Source compilation passed with both adapter exact-optional errors eliminated. Test compilation then reported three errors outside the three owned paths:

- `runtime/llm-evidence/node-run/retries/tests/answer.test.ts:50` and `:51`: TS2353 `category` absent from local `{ code?: unknown; actual?: unknown }` helper type.
- `runtime/llm-evidence/node-run/retries/tests/reacquire.test.ts:188`: TS2339 `effect` absent from the same narrow type.

Not verified: global domain check cannot pass until those outside-owned test types are repaired. Requested exact path release from lead; no edits made there. No structure rerun, full suite, Core, API/browser/panel, git or runtime-state edits performed.

Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/p8-transient/adapter-fix.md`

Notes: Source frozen on the exact three owned paths; lead independently verifies and integrates. No raw fixture/provider details were introduced into product guidance.
