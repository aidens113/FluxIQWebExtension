# t397 — generated framework-reference re-review

## Verdict

**GO.** The two Core framework-reference diffs are deterministic mirrors of the current public
TypeDoc surface. They are byte-identical, current under the owning check, and contain no generated
runtime state, credentials, machine-local paths, recorded page content, or other sensitive value.
The only run-specific material is historical run IDs already authored in public source JSDoc; no
artifact content accompanies them.

## Mirror and delta verification

- `docs/reference/framework-reference.md` and
  `packages/fluxiq/docs/reference/framework-reference.md` are both 461,806 bytes and have the same
  SHA-256: `17398DC099098C03619C70F5A8174AF611C5296F0EBABD43583E3965CCC44C7E`.
- `git diff --no-index --exit-code` returned exit 0. Their committed predecessor blobs are also the
  same object (`570ced3560a10b37c903670f78ea97c1d4231e6e`), so the two 321-addition / 196-deletion diffs
  are identical, not merely the resulting files.
- The inventory moved from 2,405 to 2,530 declaration rows. An independent name comparison found
  123 newly represented unique names and five removed unique names, matching t394. The removed
  names are the execution-binding type plus four obsolete runtime-session grant helpers/types; the
  current source either keeps the binding as a non-public internal type or removes the old helpers.
- All 2,530 generated source references are repository-relative, resolve to an existing current
  source file, and name an in-range line. No source reference is absolute or escapes the repository.

## Generator and public-surface review

`scripts/docs-reference.mjs` and the root entry point `packages/fluxiq/src/index.ts` are unchanged.
The generator has one TypeDoc entry point, uses the package tsconfig, excludes private/protected/
internal declarations, reads only declaration names/kinds/source locations/JSDoc summaries, sorts
them deterministically, and writes exactly the two files reviewed here. It reads no environment,
Git metadata, `.fluxiq` state, run artifacts, or browser data.

The public-surface movement is explained by the current source/barrel changes: defensive executor
policy, provider retry/refusal records, split Flow-bootstrap failure taxonomy, result repair
directives, Flow versioning, name matching, and related public contracts were added or moved;
DeepSeek and Flow-bootstrap splits changed source locations without changing the generator. The
generated summary counts and source distribution agree with those exports. `docs:check` rebuilt
the same in-memory inventory from that current surface and compared both declared outputs.

## Privacy and generated-data review

Whole-file scans returned zero matches for private-key blocks, common live credential prefixes,
assigned authorization/API-key/pairing-token/password/secret values, absolute Windows or user-home
paths, `.fluxiq` paths, and loopback URLs. Manual review of the added summaries found architecture,
failure-history, and policy JSDoc only; it did not find recorded page payloads or runtime artifact
content.

There is a non-blocking precision correction to t394: its claim of 57 run-ID-shaped occurrences
across 14 summaries (13 on added lines) is not reproducible. Using the repository's concrete
historical form `run-<8 alphanumeric>-<8 hex>`, the current reference has 9 occurrences of 7 unique
IDs across 8 declaration rows, with 5 occurrences on added lines. Every one of those IDs is found
verbatim in the referenced public source comment. Broader `run-*` matching also captures public API
identifiers such as run-call and run-dataset names, so it is not a useful sensitive-data count. This
count correction does not change the safety conclusion.

## Commands observed

- `Get-FileHash -Algorithm SHA256` on both mirrors — **PASS**, equal hashes.
- `git diff --no-index --exit-code` on both mirrors — **PASS**.
- `git diff --check -- docs/reference/framework-reference.md packages/fluxiq/docs/reference/framework-reference.md`
  — **PASS**; only the repository's LF-to-CRLF warning appeared.
- `pnpm docs:check` from `F:\!FluxIQ` — **PASS**, exit 0: docs-link audit reported 0 warnings / 0
  baselined findings and the reference checker reported `Deterministic framework reference is current.`

No source/generated reference was edited, staged, committed, or pushed. No provider, live, panel,
browser, Lab, test, or build command ran. This report is the only file written by t397.
