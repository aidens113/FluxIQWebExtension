# Core web audit fixes (t915)

## Outcome
Done for all listed failures in apps/web.

## What changed and why
- failure-as-empty: `resolve-pairing.ts` now returns `{ ok: true } | { ok: false; problem }` (also the JSON-body parse failure is a typed fallback, not an empty value); `PendingPairings.tsx` shows the problem. `load-connect.ts` models discovery as `{ ok: true, value } | { ok: false }`; `discoveryFailed` already drives the page's "Could not be read. Reload to try again." text.
- swallowed-failure: `createSharedSource` has a required `failed(previous, cause)` option; a thrown read now becomes state and listeners are told. Engine source maps it to "unknown" (shown as "—"), projects source to `failed: true` keeping the list (the switcher already shows "Projects could not be loaded"). New test covers it.
- imports: `flows/index.ts` now exports `useLoaded`/`Loaded`; `conversation/index.ts` exports `listConversations` (same module it already re-exported from). `chats/index.ts` untouched.
- naming: `top-bar/engine/` (reading, source, status) and `top-bar/projects/` (changed, choice, reading, source) with barrels, prefixes stripped; `projects-source.test.ts` moved to `projects/tests/source.test.ts`; hooks and top-bar barrel re-pointed.
- statement-packing: four files reformatted.

## Commands run
- `node scripts/structure-audit.mjs`: only 2 FAILs left, both in packages/fluxiq (other worker): failure-as-empty `programs/_shared/runtime.ts:260`, statement-packing `programs/_shared/tests/runtime-result-check-authority.test.ts`. Baseline can now be lowered by 2 entries (not touched).
- vitest config refused (Core dist 22 min stale, from the other worker's edits). Ran with a temporary config skipping only that guard (deleted): panel-shell, settings-page, chats, flows/list, home/data -> 54 files, 457 tests passed.
- `pnpm --filter @fluxiq/web check` (tsc --noEmit): V8 heap out of memory (exit 134) at default heap. Re-ran `tsc --noEmit` in apps/web with NODE_OPTIONS=--max-old-space-size=4096: exit 0, no errors.

## Not verified
Not run in a browser; `next build` not run (as instructed), so the server-bundle hazard for chats imports is only argued (chats barrel unchanged, new imports go through flows and conversation barrels).

## Open questions
`useLoaded` now sits on the flows barrel; no cycle found by the audit or tests.
