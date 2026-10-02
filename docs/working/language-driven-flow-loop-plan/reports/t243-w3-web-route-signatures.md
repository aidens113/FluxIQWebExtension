# t243-w3: web route signatures

## Outcome

Done. The domain signs a route state as `web-route.v1` and compares two signatures; the host runtime binds both
as `signRouteState` and `compareRouteSignatures`. One deliberate deviation from the brief: control hashes in the
sketch are FNV-1a passed through MurmurHash3's 32-bit finaliser (see Open questions).

## What changed and why

- `domain/src/runtime/llm-evidence/state-digest/fnv1a.ts` (new): the FNV-1a loop moved out of `state-digest.ts`,
  exported as `fnv1a(text): number` (unsigned 32-bit). `state-digest.ts` keeps a private `lengthTaggedHash` that
  formats `${length}:${hash.toString(16)}` exactly as before, so digest output is unchanged. Exported from the
  `state-digest/` barrel.
- `domain/src/runtime/route-state/signature-format.ts` (new): `WEB_ROUTE_SIGNATURE_FORMAT` = `{ version:
  "web-route.v1", sketchSize: 64 }`, shared by signer and comparator.
- `domain/src/runtime/route-state/signature.ts` (new): `webAutomationRouteSignature(state)`. Reads `state.page`;
  path from `path`, else the `location`'s pathname, else `""`. Path shape: lowercased, empty segments dropped,
  digit-bearing segment `#`, >24 characters `*`, joined with a leading `/`, hashed to 8 hex. `layers`: sorted
  distinct normalised dialog + blocker names joined by `\n` and hashed, or `""`. `controls`: the 64 smallest
  distinct 8-hex sketch hashes, sorted. `count`: distinct normalised control names.
- `domain/src/runtime/route-state/compare-signatures.ts` (new): `compareWebAutomationRouteSignatures`. Non-v1 or
  malformed (wrong field types) signature -> `{matches:false, closeness:0}`. Both empty -> 1, one empty -> 0.
  Otherwise bottom-k Jaccard over the 64 smallest of the union; when both `count`s are <= 64 the whole union is
  used, which is what makes it exact (see Open questions). `matches = layers equal && path equal && closeness >= 0.5`.
- `domain/src/runtime/route-state/index.ts`: barrel exports the three.
- `domain/src/runtime/host-runtime.ts`: binds `signRouteState` and `compareRouteSignatures`; capabilities unchanged.
- Tests: `domain/src/runtime/route-state/tests/signature.test.ts` (10 tests); one test added to
  `domain/src/runtime/tests/host-runtime.test.ts`.
- `docs/architecture/page-evidence.md`: one paragraph after the route-state paragraph (fields, no page text,
  under 2,048 characters, match rule).

## Commands run and observed results

All from `domain/` unless noted; bundle flags as in the brief, outdir `.test-build-scratch/t243-w3`.

- Failing first, before any source change: `pnpm exec esbuild src/runtime/route-state/tests/signature.test.ts ...`
  -> `X [ERROR] No matching export in "src/runtime/route-state/index.ts" for import
  "compareWebAutomationRouteSignatures"` and the same for `webAutomationRouteSignature`, `2 errors`. The
  host-runtime test bundle failed the same way (exit 1) on the new `../route-state` imports.
- First run after implementing: 61/62 pass; `not ok 48 - with more than 64 controls ...`: `estimate 0.3125 is not
  near 0.6` with bare FNV-1a hashes. Fixed by the finaliser (below).
- After: `node --test .test-build-scratch/t243-w3/route-state/tests/signature.test.mjs
  .test-build-scratch/t243-w3/tests/host-runtime.test.mjs
  .test-build-scratch/t243-w3/llm-evidence/state-digest/tests/*.test.mjs` -> `# tests 62`, `# pass 62`, `# fail 0`
  (includes all four existing state-digest test files: call-route-states, call-state-digests, hidden-elements,
  state-digest).
- Accuracy probe (scratch, deleted): 6 overlap shapes x 4 naming schemes (`Item {i}`, `{i}`, ...), sizes up to
  1,010 controls -> worst absolute error 0.097 against exact Jaccard, consistent with k=64 sampling error.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t243-w3 domain typecheck" pnpm --filter
  @fluxiq-web-extension/domain check` -> exit 0, no tsc errors (build-cache: "not stamped, because inputs changed
  while it ran (core:packages/fluxiq/src)" -- Core was being edited concurrently; the check itself passed).
- Repo root: `node scripts/structure-audit.mjs` -> `structure-audit: passed (157 warning(s), 118 baselined).`; no
  finding names route-state, state-digest or host-runtime.

## Not verified

- No full domain suite (`pnpm test`), no Lab, no browser, no Core-side routing exercised against these
  signatures.
- That the existing digest value is byte-identical was checked only through the existing state-digest tests
  (they compare digests for equality/inequality); no test pins a literal digest string. The refactor is a
  mechanical extraction, so the format is unchanged by construction.

## Open questions or contradictions found

- **Sketch hash is not bare FNV-1a.** Bare FNV-1a's high bits are dominated by a name's prefix, so sorted bottom-k
  sampled one name family: 150 shared / 50 / 50 numbered controls estimated 0.31 against an exact 0.6. Control
  hashes are now FNV-1a followed by MurmurHash3's fmix32. Still 8-hex and content-free; `path` and `layers`
  (equality only) remain bare FNV-1a. The design doc's "8-hex FNV-1a hashes" wording for `controls` is now
  slightly inexact; the architecture paragraph says it precisely.
- **"Exact when both hold at most 64" vs "take the 64 smallest of the union".** With two complete 64-hash sketches
  the union can exceed 64, and truncating it would not be exact. The comparator takes the whole union when both
  `count`s are <= 64 and the 64 smallest otherwise.
- The worktree also has uncommitted changes under `apps/scenario-lab/` that are not mine (another worker's).
