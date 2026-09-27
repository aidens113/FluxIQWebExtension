# t278 Post-Move Public Surface Review

Date: 2026-09-26
Repository reviewed: `F:\!FluxIQ` (read-only settled tree after the exact t274/t275 correction)
Outcome: **GO. The helper is internally owned, imported through its internal barrel, and absent from the package-root export chain.**

## Verdict

| Gate | Verdict | Evidence |
| --- | --- | --- |
| File ownership | **GO** | The only helper file is `runtime/service/flow-bootstrap-commands/bootstrap-target.ts`. The former `runtime/flow-bootstrap/bootstrap-target.ts` is absent. |
| Service import | **GO** | `service.ts` imports `assertAutomationStudioBootstrapTarget` from its existing consolidated `./service/flow-bootstrap-commands/index.ts` import. It has no direct file import and no import through the public Flow Bootstrap barrel. |
| Internal barrel | **GO** | `service/flow-bootstrap-commands/index.ts` exports `./bootstrap-target.ts`; this barrel is a service implementation group and is not exported by `runtime/index.ts`. |
| Public Flow Bootstrap barrel | **GO** | `runtime/flow-bootstrap/index.ts` no longer exports `bootstrap-target.ts`. Its only current diff in this area is the generation-failure directory-barrel replacement. |
| Package-root surface | **GO** | An index/service search finds the helper symbol only in the internal service barrel and the consuming `service.ts`. The public chain (`runtime/index.ts` -> `automation-studio/index.ts` -> `programs/index.ts` -> package `src/index.ts`) has no path to the helper. |
| Manifest surface | **GO** | The scoped `packages/fluxiq/package.json` diff changes only the package version; it adds no subpath export. |
| Structure rule | **GO** | Read-only `node scripts/structure-audit.mjs` exits 0 after the move. No new import or barrel violation is reported. |

## Export-chain conclusion

T275's package-root exposure is closed. The service collaborator now terminates at this internal
path:

```text
runtime/service/flow-bootstrap-commands/bootstrap-target.ts
  -> runtime/service/flow-bootstrap-commands/index.ts
  -> imported by runtime/service.ts
```

`runtime/service.ts` does not re-export the helper, and `runtime/index.ts` does not export the
`service/flow-bootstrap-commands` barrel. Consequently the package-root wildcard chain exports the
service API but not `assertAutomationStudioBootstrapTarget` itself.

## Validation performed

- Read t274 and t275, then inspected the final helper, internal and public barrels, service import,
  runtime/package-root barrel chain, and scoped package-manifest diff.
- Searched all Core `index.ts` and `service.ts` files for the helper name and former file name. The
  only barrel occurrence is the internal service barrel; the remaining occurrences are its four
  service call sites and consolidated import.
- Ran `node scripts/structure-audit.mjs`: exit 0, with existing advisory/baselined findings and one
  lowerable baseline entry.
- Ran no tests, builds, baseline generation, source/shared-document edits, live commands, or
  provider/browser/Lab operations. This report is the only file written.
