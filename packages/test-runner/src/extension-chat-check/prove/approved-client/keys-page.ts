/** The path of the web panel's keys page, the one `fluxIQWebPageAddress({ kind: "keys" })` in `apps/extension/src/shared/fluxiq-web-routes.ts` gives; `tests/keys-page.test.ts` fails when the two differ. */
export const KEYS_PAGE_PATH = "/security/keys";

/** True when `address` is exactly the keys page on `coreApiUrl`'s origin: no query, fragment or credential. */
export function isBareKeysPageAddress(address: string | undefined, coreApiUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(address ?? "");
  } catch {
    return false;
  }
  return url.origin === new URL(coreApiUrl).origin && url.pathname === KEYS_PAGE_PATH && url.search === "" && url.hash === "" && url.username === "" && url.password === "";
}
