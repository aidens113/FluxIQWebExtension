# t191 -- Version and compatibility audit

Status: Complete -- release edits required
Repository scope: `F:\!FluxIQ` and `F:\!FluxIQWebExtension`
Date: 2026-09-26

## Verdict

The public Core package `fluxiq` requires a pre-1.0 minor version increment
from `0.6.0` to `0.7.0` before release, plus a distinct 0.7.0 migration-note
entry. No other package in either repository requires a version change for this
work.

This is not merely an additive type release. Existing hosts observe new default
defensive execution and provider retry behavior without opting in; grant
purpose no longer authorizes task kinds; result verification carries new
screened repair data; and the exported destructive-consequence membership
changes. The current final classifier replaces `modify_existing` with
`send_or_publish` relative to `HEAD`, while retaining `move_money` and `delete`.
That exported-value change can alter exhaustive host logic even though its
TypeScript signature is unchanged.

## Policy evidence

Core's `docs/architecture/package-boundaries.md`, under **Validation And
Release Policy**, says that before 1.0 compatible changes increment the patch
version, while intentional API breaks increment the minor version and require a
Migration Notes entry. It explicitly judges compatibility by consumer-visible
behavior rather than type signatures and calls a changed published number a
minor release.

The same document records why reusing a package version is ambiguous: two
behaviorally different `fluxiq@0.2.1` builds could not be distinguished by
version, so the behavior received its own later minor. Repository history shows
`fluxiq` was changed from 0.5.0 to 0.6.0 in commit `5300d47` on 2026-09-16;
the audited changes are later working-tree changes. Folding them into the
already committed 0.6.0 identity would repeat the documented ambiguity.

There is no `CHANGELOG`, Changesets configuration, release-notes file, or
version/release script in either repository. Core uses the Migration Notes in
`docs/architecture/package-boundaries.md` as its compatibility record. Its only
package-release command is the validation gate `pnpm package:validate`;
registry publication, tags, signing, and provenance are expressly separate
owner-controlled actions. No additional release workflow should be invented.

## Exact required edits before release

1. In `F:\!FluxIQ\packages\fluxiq\package.json`, change `version` from
   `0.6.0` to `0.7.0`.
2. In `F:\!FluxIQ\docs\architecture\package-boundaries.md`:
   - change the current-version sentence from `fluxiq` 0.6.0 to 0.7.0;
   - create a new `### 0.7.0` Migration Notes entry for the audited changes;
   - move the new provider-retry/grant-purpose, screened result-repair,
     defensive-executor, and destructive-export compatibility material out of
     the historical 0.6.0 entry and into 0.7.0;
   - reconcile the destructive-export note with the post-t189 final set:
     `move_money`, `delete`, and `send_or_publish`; `modify_existing` is no
     longer gated merely by class.

No lockfile edit is required: Core's `pnpm-lock.yaml` does not record the
workspace package's own version. No separate changelog file exists.

## Package-by-package verdict

| Package/path | Visibility | Verdict | Evidence |
| --- | --- | --- | --- |
| `F:\!FluxIQ\packages\fluxiq` (`fluxiq`) | Public, `publishConfig.access: public`; `fluxiq/automation-studio` export | **Bump 0.6.0 to 0.7.0** | Observable default behavior and exported-value changes are intentional pre-1.0 breaks under Core policy. Changed runtime barrels also add public defensive-policy, provider-retry/refusal, repair-screen, and repair-directive exports through the existing Automation Studio subpath. |
| `F:\!FluxIQ\packages\contracts` (`@fluxiq/contracts`) | Public | **No change** | No manifest, export barrel, or package source in this package changed. The new Automation Studio contracts are owned by `packages/fluxiq`. |
| `F:\!FluxIQ\packages\client-gateway-websocket` | Public | **No change** | No manifest, exports, or gateway contract changed. |
| Core root and `apps/web` | Private | **No change** | They are not published packages; their manifests and exports are unchanged. |
| All packages in `F:\!FluxIQWebExtension` | Private | **No change** | Every manifest declares `private: true`; no manifest changed, and this repository defines no package version/changelog policy. Domain/test-contract export additions remain repository-local. |

## Read-only checks performed

- Inspected all package manifests for name, version, `private`, exports, and
  `publishConfig`.
- Confirmed no package manifest is modified in either working tree.
- Reviewed the changed public Core barrels and the existing export chain from
  `fluxiq/automation-studio`.
- Searched both repositories for changelog, Changesets, release-note, semver,
  version-bump, publishing, and release-workflow conventions.
- Inspected the package-version history and verified that no workspace package
  version is stored in Core's lockfile.

No manifest, source, shared document, or existing architecture document was
edited. No build, test, package validation, Lab run, commit, tag, or publish was
performed.
