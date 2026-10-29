# t794 report: pnpm check builds libraries first

Outcome: Done.

Cause: tsconfig.base.json `paths` map only some `fluxiq/*` subpaths to source (`fluxiq/*` -> src/*/index.ts misses identity-access, auth, llm-models, action-permissions...). Those resolve via package.json `exports` to `dist`, which web:check read unrebuilt. The web:check fingerprint already included dist, but the dist itself was stale.

Choice: (a). Root `check` now runs `cli.mjs contracts:build fluxiq:build client-gateway-websocket:build` (cache-decided) between the structure audit and the parallel checks. (b) would need every exports entry mirrored in paths (several point at non-index files), a second list to drift; (a) is correct for all subpaths and free when unchanged.

Changed (Core tree fxwork/t794/!FluxIQ): package.json (check script), scripts/build-cache/tests/registry.test.mjs (asserts library builds precede checks, in build order), docs/architecture/code-structure.md (one section).

Validation:
- `pnpm check` cold: 4m14s, rc 0 (builds reran: contracts 7s, fluxiq 72s, gateway 4s).
- `pnpm check` again: 34s, rc 0, all 8 cached steps reused (each <1.1s); the rest is node --test.
- Probe: added `export const t794Probe` to fluxiq identity-access index plus a temp web file importing it via `fluxiq/identity-access` (dist-only path); ran the build + parallel check steps (audit skipped as the probe violates it): fluxiq:build rebuilt (92s), web:check re-ran (50s) and passed, 3m20s total. Reverted both; git status shows only the 3 intended files.
- registry.test.mjs: pass. `pnpm structure:check`: see return.
Not verified: full `pnpm test`; the web:build step not run.
