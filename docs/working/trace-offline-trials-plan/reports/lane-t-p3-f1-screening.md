# lane-t-p3-f1-screening report

## Outcome

Done. Both parity divergences D1 found in Core's trace screening are fixed in the t742 Core worktree, with tests written first. Nothing is committed.

## What changed and why

All files are under `packages/fluxiq/src/programs/automation-studio/runtime/gateway-trace/`.

- `screening-sink.ts`: a redacted event used to be rebuilt field by field, which dropped `session` (divergence 1, the 10 capture gaps). It is now forwarded as `{ ...input, payload, redactions }`. Every other field is kept as it came, so a field added to the event later is kept too. `referencedDigests` is no longer defaulted to `[]` on the redacted path, so it now matches the clean path, which forwards the input unchanged.
- `payload-screen.ts`: a string leaf that matches `^[0-9a-f]{64}$` goes to a new `screenDigest`. That function swaps any card-shaped digit run for a single `"0"` stand-in and then runs the leaf through the full secret screen. A credential shape still withholds the leaf, but the card-number screen cannot. This fixes divergence 2, where an artifact digest was redacted as a card. `evidence-screen.ts` is unchanged. The header comment cites D21.
- `tests/screening-sink.test.ts` adds:
  - A redacted event keeps `kind`, `source`, `correlation`, `payloadSchema`, `artifactIds`, `referencedDigests`, `session` and an extra `laterField`. A capturing inner sink checks that every field other than payload and redactions is deep-equal to the input, and the stored event keeps `session` and its digests.
  - A 64-hex digest whose digit run `4111111111111111` passes Luhn is kept as is, both as a JSON leaf and in text, where the very payload object comes back.
  - A card number in text is still withheld.
  - Four leaves are still screened and lose the digit run: the digest with one uppercase letter, a 63-character version, a 65-character version, and the digest embedded in text.

## Commands run and observed results

All commands were run from `C:/Users/osrs_/FluxStuff/fxwork/t742/!FluxIQ/packages/fluxiq` unless noted.

- Before the fix, `pnpm exec vitest run src/programs/automation-studio/runtime/gateway-trace` gave `Tests 2 failed | 65 passed (67)`. The two failures were the new sink test and the new digest test.
- After the fix, the same command gave `Test Files 8 passed (8)` and `Tests 67 passed (67)`. I reran it after the typing fix below and got the same result.
- The first `pnpm exec tsc --noEmit` failed with TS2322 because my test passed numeric correlation revisions. I changed them to strings, reran it, and it exited 0.
- `node scripts/structure-audit.mjs`, run from the Core root, printed `structure-audit: passed (427 warning(s), 1152 baselined).` None of the warnings are about gateway-trace files. It also said `1 baseline entries can be lowered`; that entry is not from my files and I did not run the baseline command.

## Not verified

- I did not re-run the D1 replay or parity runs on real traces to confirm the 11 divergences are gone.
- I did not run Core's full suite. I did not run the build, per the brief.

## Open questions or contradictions found

- The brief listed the structure audit as runnable from packages/fluxiq, but the script is at the Core root (`scripts/structure-audit.mjs`), so I ran it from there.
