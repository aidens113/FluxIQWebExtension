# t387 — Core integration evidence review

## Verdict

**GO.** The t379 provider-free integration evidence is internally coherent,
and read-only inspection confirms that its three named Core production outputs
are still current and are still the exact bytes visible to the downstream
domain package. Downstream work may rely on the current Core output for the
validated packing/projection/measurement seams.

This verdict does not authorize or claim provider/live validation, and it does
not extend t379's Core-only results into a claim that downstream tests or builds
have passed.

## Evidence review

t379 identifies the working directory (`F:\!FluxIQ`), run date, exact commands,
scope, test-file and test-count totals, skip/failure totals, durations, and exit
status for each gate:

- focused integrated seams: seven explicit Vitest files, 145/145 passed, zero
  skipped or failed;
- complete Automation Studio runtime directory: 275 files, 3,138 passed, one
  intentional skip, zero failed (3,139 total);
- `pnpm --filter fluxiq check`: `tsc --noEmit`, exit 0; and
- `pnpm --filter fluxiq build`: clean build, compile, and declaration-import
  rewrite, exit 0.

Those details are sufficient to identify and reproduce the claimed
provider-free matrix, distinguish it from the superseded 139-test observation,
and show that check/build followed stable-source testing. The focused set also
names the hardened discriminator's exhaustion and convergence cases and their
individual durations, so the result is not merely a package-level compilation
claim.

## Freshness and byte identity re-check

Read-only inspection on 2026-09-26/27 found the latest file anywhere under
`packages/fluxiq/src` remains `runtime/flow-draft/entry.ts` at
`2026-09-27T06:15:49.6365039Z`. No Core source is newer than the clean build.
The three production seams still have the exact source/build timestamps recorded
by t379:

| Seam | Source UTC | Source SHA-256 now | Built UTC | Built SHA-256 now | Matches t379 built hash | Junction bytes identical |
| --- | --- | --- | --- | --- | --- | --- |
| projection bound | `2026-09-27T06:07:34.1907572Z` | `9C8C39E162429B4F7A93AFC5F10887C0A80F984104CECD0FB9D9533BAE75BD9B` | `2026-09-27T06:21:46.3932200Z` | `DC796ABE9DE0F780E964F6E80700D7628E92B9EA8647F325DBEE8327C4691131` | yes | yes |
| draft packing | `2026-09-27T06:15:49.6365039Z` | `48AC67F3A41EA2DC98EB8E64557B72DD96970AC533118786E0F7B70A1EA9A2EB` | `2026-09-27T06:21:46.3150941Z` | `B8948F72BD2A804DE2930D85356E7B997393ECB3AB1FFA85C0AFA7CBB273B743` | yes | yes |
| packed measurement | `2026-09-27T06:12:43.2602761Z` | `4FBD186F732D9968001053CE3A2C837F03766B2CE5CD2E4797EAB610B73B1349` | `2026-09-27T06:21:47.7121877Z` | `29A46A8F1947F906A2680D90548400BE74CB91B4D833C065864FF0BD31CF3153` | yes | yes |

`F:\!FluxIQWebExtension\domain\node_modules\fluxiq` remains a junction whose
target is `F:\!FluxIQ\packages\fluxiq`. Hashing each built file through the
Core path and through that junction returned the same SHA-256 (3/3).

The final t377 and t378 reports were written at
`2026-09-27T06:16:33.4405161Z` and `2026-09-27T06:15:13.6592020Z`. The newest
Core architecture document was written at `2026-09-27T06:20:57.3847480Z`.
All precede the clean build output at `06:21:46Z` or later; documentation does
not participate in emitted package bytes. Later downstream plan/report edits
likewise do not stale Core `dist`.

## Missing proof and limits

No durable raw console log or machine-readable test artifact is linked from
t379. Under the repository rule that a worker report is a claim rather than
independent verification, the test/check/build results still depend on t379's
recorded observation; this review did not rerun them because the brief forbade
broad suites. This is an evidence-retention limitation, not a freshness or
identity failure, and it does not overturn the GO for relying on the current
Core output.

I performed only read-only status, timestamp, junction-target, and SHA-256
inspection. I did not run tests/builds, invoke provider/live behavior, edit
product/shared-plan files, or commit/push.
