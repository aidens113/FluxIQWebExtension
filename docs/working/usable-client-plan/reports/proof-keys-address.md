# Proof keys-address check (t915) - Partial

Outcome: fix made and unit-tested; the full proof re-run could NOT complete (environment, not the fix).

Cause: confirmed stale. The extension's route table (`apps/extension/src/shared/fluxiq-web-routes.ts`) gives
the keys page `/security/keys`, with `url.search`/`url.hash` cleared, so no unlock fragment or query. The proof
still demanded the old `/programs/secret-keys`. I did not observe the live URL (the run never got that far); this is from reading the route table.

Change (all under prove/approved-client, no extension or Core source touched):
- `keys-page.ts` (new): `KEYS_PAGE_PATH = "/security/keys"` and `isBareKeysPageAddress(address, coreApiUrl)`:
  same origin as Core, exactly that path, no search, hash, username or password.
- `prove.ts`: the check calls it; the signed-in panel page also opens `KEYS_PAGE_PATH`.
- `index.ts`: re-exports both.
- `tests/keys-page.test.ts` (new): accepts the bare page; rejects old path, query, fragment, credentials,
  other origin, junk. A drift guard reads the extension route table source (climbing to find it) and asserts its keys path equals `KEYS_PAGE_PATH`.
  test-runner cannot import extension source (rootDir), so the expectation is guarded by that test, not an import.

Commands:
- `pnpm --filter @fluxiq-web-extension/test-runner build` refused: Core build "not current" (ui-components stale). Did not rebuild Core (out of bounds); ran `npx tsc -p tsconfig.json` in packages/test-runner instead: clean.
- `node --test dist/extension-chat-check/prove/approved-client/tests/*.test.js` -> 10 pass, 0 fail.
- `node scripts/structure-audit.mjs` (EXT) -> "passed (250 warning(s), 551 baselined)".
- Proof, run twice: exit 2 both times, before any check ran: "Core web panel production build did not succeed ...
  core-web-build printed nothing for 600 s". Evidence: `C:\Users\osrs_\FluxStuff\evidence\t198\2026-11-16T21-25-37-649Z-chrome` (1002 s)
  and `...\2026-11-16T21-47-20-515Z-chrome` (639 s). `checks` empty.

Ruled out / unknown: the failure is in the isolated Core's Next production build stalling silently, upstream of my change. Likely candidates (unverified): contention with the running :3000 panel/other worker's build, or Core's stale ui-components build. Not diagnosed further.

Next: re-run the same proof command when the machine is quiet (or after Core libraries are rebuilt by the owner); expected all 20 checks true.
