# Codex held lane validation (t567)

## Outcome

Held drawing and reveal implementation reviewed; focused runtime tests and the Chromium content harness pass. Final integrated Core build/check and audits passed. A headed company-website live run is next; its source pair stays frozen.

## Changes and review

- Preserved the held drawing normalization/recording/repair transport changes in both repositories.
- Recovery now confirms reveal only on successful action. A disappearing target retains an honest unconfirmed-reveal diagnostic; regression added beside recovery.
- Authored web-capabilities documentation describes the scroll ladder and remaining nested-clipping coverage limitation.
- Added Core service persistence coverage: apply a repaired target with the opaque drawing signal, close storage, reopen through a new service, and assert the saved graph retains the complete target. The first assertion incorrectly required an incomplete nested object; corrected to compare the complete target. Product persistence retained the signal on both runs.

## Observed supervisor checks

- Core target normalizer: `pnpm exec vitest run .../model/tests/action-element-target.test.ts --maxWorkers=2 --minWorkers=1` -> 10 tests passed.
- Core durable-patches file (four tests including the new close/reopen case) -> 4 passed.
- Extension targeted recovery/reveal/recording/shared tests -> 137 passed, including target-disappearance regression.
- Domain target/plan-resolution/fingerprint tests -> 232 passed.
- Chromium content harness: `node scripts/test-content.mjs -- tests/reveal-by-scroll --workers=1` -> 1 passed; actual page scrolls reveal the hidden lazy control, its click lands, and a subsequent press loads more people.
- Domain package check -> exit 0. Extension check -> exit 0 but unstamped because the new Core test changed its inputs during the check; final frozen pair requires another check.
- Core fluxiq check before integration -> exit 0. Core audit -> passed (400 warnings, 1154 baselined); downstream audit -> passed (210 warnings, 638 baselined).
- Dev merged into both lane branches, incorporating the accepted judge fix and Lab build lease. Final combined Core tests passed 30/30 (judge weighing, target normalization, durable repairs); cache-off Core build/check exited 0; both downstream package checks exited 0 on the frozen pair. Final audits passed (Core 401 warnings/1154 baselined, downstream 210 warnings/638 baselined).

## Invalid probes and limitations

An initial harness launch overlapped Core's output rebuild and failed bundling missing modules; it is invalid as product evidence. After the compiler finished and a cache-disabled build verified the existing output stamp, the harness passed. The original build CLI was stopped only during optional cache publication, after its output stamp existed; the verifying build returned `reuse`, matching inputs and outputs, exit 0.

The content harness exercises the actual content-script bundle in Chromium, with its runtime API stubbed. It does not prove extension service-worker delivery or the model's discovery/build/judge/replay route. Those remain live lane acceptance work. Nested clipping of boxed hidden controls remains a known coverage gap. No user browser, profile, panel, credentials or runtime state was changed.
