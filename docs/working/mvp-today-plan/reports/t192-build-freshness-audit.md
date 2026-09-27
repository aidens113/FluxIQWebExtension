# t192 -- Build freshness audit

Status: Complete
Repository scope: `F:\!FluxIQWebExtension` and `F:\!FluxIQ`, read-only except this report
Date: 2026-09-26

## Verdict

**NO-GO for the isolated live command.** Every required output is present, and
the domain, extension E2E, scenario Lab, and runner trees are fresh relative to
their tracked production inputs. Core is not fresh as a complete build: the
current `fluxiq` runtime source and package output are newer than the existing
Next web build that consumes them.

This is a rebuild gate, not a product or live-run failure. Rebuild Core through
its root build script, re-audit the timestamps, then repeat t178's provider-free
readiness check before any provider-backed command.

All timestamps below are UTC from one filesystem snapshot on 2026-09-27 UTC.

## Per-tree audit

| Tree | Required output evidence | Newest relevant tracked input | Result | Rebuild command if required |
| --- | --- | --- | --- | --- |
| Core | Contracts `dist/index.js` 23:26:26; runtime `dist/index.js` 00:07:42; gateway `dist/index.js` 23:26:38; web `.next/BUILD_ID` 23:27:51 | Runtime `runtime/action-permissions/destructive.ts` 00:06:07 | **NO-GO.** The three package outputs are newer than their own inputs, but the web build predates both the current runtime input and its 00:07:42 package build. The root build order has not completed over the current Core tree. | From `F:\!FluxIQ`: `pnpm build` |
| Downstream domain | `domain/dist/index.js` 23:51:17 | `domain/src/output-nodes/definitions.ts` 22:04:11 | **GO.** Output exists and is newer than the latest tracked non-test source/config/build input. | None |
| Extension E2E | `dist/e2e-chromium/content/index.js` 23:51:23; required `manifest.json` present | `apps/extension/src/runtime/action-runner.ts` 21:20:32; direct domain-client and Core source aliases are older still | **GO.** The generated browser bundle is newer than its build inputs. The copied manifest retains the source manifest's old timestamp, so presence is checked on `manifest.json` and freshness on the generated content bundle, not on the copied file's timestamp. | None |
| Scenario Lab | `apps/scenario-lab/dist/server.js` 00:02:59 | Own latest production input is `package.json` on 2026-09-23; its built test-contract dependency is 00:02:54, newer than that dependency's latest source at 19:52:50 | **GO.** Server and required dependency output exist and are newer than their inputs. | None |
| Test runner | `packages/test-runner/dist/cli.js` 00:04:24 | `packages/test-runner/src/flow-lane/extraction-read.ts` 19:53:35 | **GO.** CLI exists and is newer than runner inputs; runtime workspace dependencies are present and fresh (`domain` 23:51:17, `test-evidence` 00:02:53, `test-contracts` 00:02:54). Core is loaded as a runtime package and is handled by the Core row. | None |

## Required remediation

Run exactly this in a shell that is not running the Lab:

```powershell
Set-Location -LiteralPath 'F:\!FluxIQ'
pnpm build
```

The root script is required rather than only rebuilding `fluxiq`: it builds
contracts, runtime, gateway, and then the Next web application in dependency
order. A successful runtime-only build already exists; the missing freshness
fact is a web build after that runtime.

After it passes, confirm the new `F:\!FluxIQ\apps\web\.next\BUILD_ID` mtime is
later than the newest current Core production input and package outputs. Then
return to `F:\!FluxIQWebExtension` and perform the immediate t178 go/no-go and
provider-free dry-run checks. This audit does not inspect credentials and does
not replace those checks.

## Method and limits

- Read t178 and t184 plus the package/build scripts for the five trees.
- Compared required output markers with the newest tracked non-test source,
  config, package, and build-script inputs. Dependency outputs used by scenario
  Lab and runner were checked separately.
- Used the extension's generated content bundle as its freshness marker because
  `build-extension.mjs` copies the manifest; the copied manifest timestamp is
  not a build-completion timestamp.
- Did not infer freshness from existence alone and did not inspect any prior
  run artifact.

No source, shared document, existing generated output, build, test, browser,
provider, Lab process, commit, or push was touched.
