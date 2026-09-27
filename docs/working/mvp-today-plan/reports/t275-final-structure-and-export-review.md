# t275 Final Structure And Export Review

Date: 2026-09-26
Repository reviewed: `F:\!FluxIQ` (read-only settled tree after the t274 follow-up)
Outcome: **NO-GO: import structure now passes, but the correction exposes an internal service collaborator through Core's package root.**

## Verdict

| Area | Verdict | Evidence |
| --- | --- | --- |
| Directory-barrel import rule | **GO** | `service.ts` imports `assertAutomationStudioBootstrapTarget` through `./flow-bootstrap/index.ts`; read-only `node scripts/structure-audit.mjs` exited 0. The earlier direct-import violation is gone. |
| Target-helper ownership | **NO-GO** | `bootstrap-target.ts` remains under the public `runtime/flow-bootstrap/` ownership group even though it is service orchestration over `getFlow`, representation, router, and Subflow-count ports. T274's requested move into internal `service/flow-bootstrap-commands/` did not occur. |
| Public export surface | **NO-GO** | `flow-bootstrap/index.ts` newly exports `./bootstrap-target.ts`; `runtime/index.ts` exports `./flow-bootstrap/index.ts`; `automation-studio/index.ts`, `programs/index.ts`, and package `src/index.ts` transitively export that runtime barrel. Therefore `assertAutomationStudioBootstrapTarget` is newly reachable from the package root. |
| Runtime-adaptation barrel | **GO** | `service/runtime-adaptation/index.ts` newly exports the cohesive reauthor-continuation module for `service.ts`'s internal consolidated import. `runtime/index.ts` does not export this service sub-barrel, and `service.ts` re-exports only the pre-existing intervention-mode/context names, not the helper or detail projector. |
| Package manifest exports | **GO** | The scoped `packages/fluxiq/package.json` diff changes only `0.6.0` to `0.7.0`; it adds no subpath export. The unwanted exposure is caused by the source barrel chain, not the manifest. |

## Exact residual violation

The settled edit resolves the mechanical structure-audit failure by adding this line to the public
Flow Bootstrap barrel:

```ts
export * from "./bootstrap-target.ts";
```

That is precisely the correction t274 said not to make. The complete export path is:

```text
runtime/flow-bootstrap/bootstrap-target.ts
  -> runtime/flow-bootstrap/index.ts
  -> runtime/index.ts
  -> automation-studio/index.ts
  -> programs/index.ts
  -> src/index.ts
```

The symbol was not present in the prior `flow-bootstrap/index.ts` and is unrelated to a documented
public Flow Bootstrap contract. Passing the structure audit therefore does not make this settled
layout release-safe.

## Required correction

Move the target assertion into `runtime/service/flow-bootstrap-commands/`, export it only from that
internal group's barrel, and add it to `service.ts`'s existing consolidated import from
`./service/flow-bootstrap-commands/index.ts`. Remove the export from `flow-bootstrap/index.ts` and
the old file. This satisfies the directory-barrel rule without widening the package root. Re-run
the structure audit afterward; no baseline increase should be needed.

## Validation performed

- Read t274 and inspected the settled `service.ts`, Flow Bootstrap, runtime-adaptation, runtime, and
  package-root barrel chain plus the scoped package-manifest diff.
- Ran `node scripts/structure-audit.mjs`: exit 0, 185 advisory warnings, 358 baselined findings, and
  one lowerable baseline entry. No failing structure finding remained.
- Ran no tests, builds, baseline generation, source/shared-document edits, live commands, or
  provider/browser/Lab operations. This report is the only file written.
