/**
 * The web panel's AI keys page: the path and fragment `fluxIQWebPageAddress({ kind: "keys" })` in
 * `apps/extension/src/shared/fluxiq-web-routes.ts` gives (`/settings#ai-keys`); `tests/keys-page.test.ts` fails when
 * the two differ. The proof runs its own instance from the Core beside this tree, so only the current page counts.
 */
export const KEYS_PAGE_PATH = "/settings";

/** The fragment that opens Settings at its AI keys section. */
export const KEYS_PAGE_HASH = "#ai-keys";

/** True when `address` is exactly the AI keys page on `coreApiUrl`'s origin: its own fragment only, no query or credential. */
export function isBareKeysPageAddress(address: string | undefined, coreApiUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(address ?? "");
  } catch {
    return false;
  }
  return url.origin === new URL(coreApiUrl).origin && url.pathname === KEYS_PAGE_PATH && url.search === "" && url.hash === KEYS_PAGE_HASH && url.username === "" && url.password === "";
}
