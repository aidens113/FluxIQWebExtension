# t185 Downstream suite rerun

Status: Complete

## Result

The complete downstream workspace test suite passes after the t177 domain assertion changes
and t181 test-runner assertion changes.

Authoritative command:

```powershell
pnpm test
```

Root expansion: `pnpm -r test` across 10 of 11 workspace projects.

- Exit code: `0`.
- Packages passed: 10.
- Tests passed: 3,920.
- Tests failed: 0.

## Package totals

| Package | Tests | Passed | Failed |
| --- | ---: | ---: | ---: |
| `@fluxiq-web-extension/domain` | 847 | 847 | 0 |
| `@fluxiq-web-extension/extension` | 832 | 832 | 0 |
| `@fluxiq-web-extension/scenario-lab` | 571 | 571 | 0 |
| `@fluxiq-web-extension/test-runner` | 1,462 | 1,462 | 0 |
| `@fluxiq-web-extension/test-contracts` | 145 | 145 | 0 |
| `@fluxiq-web-extension/test-matrix` | 17 | 17 | 0 |
| `@fluxiq-web-extension/test-evidence` | 17 | 17 | 0 |
| `@fluxiq-web-extension/agent-orchestrator` | 16 | 16 | 0 |
| `@fluxiq-web-extension/real-site-policy` | 7 | 7 | 0 |
| `@fluxiq-web-extension/boundary-audit` | 6 | 6 | 0 |
| **Total** | **3,920** | **3,920** | **0** |

The two suites directly relevant to the preceding assertion fixes passed at their expected
totals: domain 847/847 and test-runner 1,462/1,462. No remaining failure required isolation.

The suite was observed once with full output, then repeated with output filtered only to each
package's TAP totals, completion marker, recursive scope, and captured process exit. The
second run above is the authoritative recorded result and ended with `__EXIT_CODE=0`.

## Boundaries

- No source, shared working document, Core file, or existing report was edited.
- Only ordinary ignored test/build output produced by package test scripts was regenerated.
- No browser, Lab run, provider call, live scenario, fix, commit, or push was performed.
- Added only this report.
