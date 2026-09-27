# t195 -- Core version compatibility metadata

Status: Complete
Repository scope: `F:\!FluxIQ`, with this report in `F:\!FluxIQWebExtension`
Date: 2026-09-26

## Result

Applied the t191 public-package release verdict to the two owned Core files.
The public `fluxiq` package is now version 0.7.0, and the new host-visible
compatibility facts have their own 0.7.0 Migration Notes entry. The historical
0.6.0 entry remains unchanged from `HEAD`.

## Changes

- `packages/fluxiq/package.json`
  - changed `version` from `0.6.0` to `0.7.0`.
- `docs/architecture/package-boundaries.md`
  - changed the current public-package inventory to `fluxiq` 0.7.0;
  - added a distinct 0.7.0 migration entry covering grant-accounted provider
    retries, non-authorizing grant-purpose semantics, screened result repair,
    default defensive execution, and the changed high-risk export;
  - records the post-t189 high-risk set exactly as `move_money`, `delete`, and
    `send_or_publish`, with `modify_existing` and `create_new` not gated merely
    by class;
  - removed those new compatibility paragraphs from the 0.6.0 section, leaving
    that historical entry identical to its committed content.

No lockfile edit is needed or was made; the workspace package version is not
recorded in Core's `pnpm-lock.yaml`.

## Validation

- Parsed `packages/fluxiq/package.json` successfully and observed
  `name=fluxiq`, `version=0.7.0`.
- `git -c core.safecrlf=false diff --check -- packages/fluxiq/package.json
  docs/architecture/package-boundaries.md`: passed.
- Scoped status showed only the two owned Core files modified; `pnpm-lock.yaml`
  remained unchanged.
- Targeted heading and compatibility searches found one 0.7.0 entry, followed
  by 0.6.0, and one occurrence of each moved compatibility section.
- Reviewed the complete scoped diff; relative to `HEAD`, the documentation
  change is the current-version line plus the new 0.7.0 entry, confirming the
  committed 0.6.0 text was preserved.

Metadata/documentation-only task: no build, test, package validation, Lab run,
commit, tag, or publish was performed.
