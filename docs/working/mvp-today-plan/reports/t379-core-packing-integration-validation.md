# t379 — Core packing integration validation

## Verdict

**GO for the assigned provider-free Core integration gate.** After t377's
oversized-input correction and t378's hardened discriminator were declared
stable, the complete validation sequence was rerun from scratch. The focused
integration set passed 145/145, the broad Automation Studio runtime suite
passed 3,138 tests with one intentional skip, and the `fluxiq` package check
and clean build both exited zero.

This is not a downstream or live-run authorization. No provider/live command
ran, and no downstream build, test, or generated output was invoked or
modified.

## Stable-source validation

Run from `F:\!FluxIQ` on 2026-09-26 after the supervisor's source-stable
signal.

### Focused integrated seams

```powershell
pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/tests/evidence-loop-steps.test.ts src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts src/programs/automation-studio/runtime/service/flow-bootstrap-commands/tests/evidence-trace.test.ts src/programs/automation-studio/runtime/flow-draft/tests/entry.test.ts src/programs/automation-studio/runtime/flow-draft/tests/entry-budget.test.ts src/programs/automation-studio/runtime/llm/evidence-loop/tests/draft-shown.test.ts src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts
```

PASS — 7 files, 145/145 tests, zero skipped or failed, 77.34 seconds.

File counts were:

- projection bound: 25;
- generation diagnostics: 51;
- service evidence trace: 24;
- draft entry: 15;
- draft entry budget: 5;
- packed draft measurement: 14; and
- hardened deterministic service fixture: 11.

The service file included the direct malformed-shape discriminator plus both
the 26-decision exhaustion branch and same-prefix decision-11 convergence
branch. All 11 file tests passed; the exhaustion case took 14.632 seconds and
the convergence case 6.934 seconds.

### Broadest practical Automation Studio runtime suite

```powershell
pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime
```

PASS — 275 files, 3,138 passed, 1 intentional skip, zero failed (3,139 total),
179.22 seconds. This directory-wide package suite exercised the integrated
Flow Bootstrap, draft, LLM, execution, recovery, service, persistence, and
result-verification runtime surface without a live provider invocation.

### Package gates

```powershell
pnpm --filter fluxiq check
```

PASS — `tsc --noEmit`, exit 0.

```powershell
pnpm --filter fluxiq build
```

PASS — clean TypeScript build plus declaration-import rewrite, exit 0:

```text
tsc -b tsconfig.build.json --clean &&
tsc -b tsconfig.build.json &&
node ../../scripts/rewrite-declaration-imports.mjs dist
```

## Output freshness and identity

The clean Core build emitted all three changed production seams after their
source timestamps:

| Seam | Source UTC | Built JS UTC | Built JS SHA-256 |
| --- | --- | --- | --- |
| projection bound | `2026-09-27T06:07:34.1907572Z` | `2026-09-27T06:21:46.3932200Z` | `DC796ABE9DE0F780E964F6E80700D7628E92B9EA8647F325DBEE8327C4691131` |
| draft packing | `2026-09-27T06:15:49.6365039Z` | `2026-09-27T06:21:46.3150941Z` | `B8948F72BD2A804DE2930D85356E7B997393ECB3AB1FFA85C0AFA7CBB273B743` |
| packed measurement | `2026-09-27T06:12:43.2602761Z` | `2026-09-27T06:21:47.7121877Z` | `29A46A8F1947F906A2680D90548400BE74CB91B4D833C065864FF0BD31CF3153` |

Read-only downstream identity inspection found
`F:\!FluxIQWebExtension\domain\node_modules\fluxiq` is a junction whose
target is exactly `F:\!FluxIQ\packages\fluxiq`. Reading each of the three
built JS files through that downstream junction produced the same SHA-256 as
the Core path (3/3 identical). Thus the installed downstream link currently
resolves the freshly built Core bytes; no downstream output was rebuilt or
otherwise mutated to establish this.

## Failures and superseded evidence

There were no failures in the stable-source validation matrix. An earlier
focused observation (139/139) completed before t377 reported the blocking
oversized-input path. It was explicitly discarded, no broad gate was run on
that state, and it is not counted as closure here. A read-only PowerShell
freshness formatting command later had a parser error (`empty pipe element`);
the corrected read-only command succeeded and produced the table above. This
was not a product, test, check, or build failure.

## Scope

I wrote only this downstream worker report. I made no product or shared-plan
edit, did not commit or push, did not run a provider or live path, and did not
run or mutate downstream generated output. Remaining downstream propagation,
privacy/accounting closure, and any separately authorized live measurement
remain outside this Core-only GO.
