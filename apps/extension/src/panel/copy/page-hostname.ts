/**
 * The hostname of `url` for a sentence ("Working in: shop.example.com"), or
 * undefined when there is no URL or it has no host. Never the full URL: the
 * simple view shows no URL other than a hostname.
 */
export function pageHostname(url: string | undefined): string | undefined {
  if (!url) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (error) {
    // `new URL` throws TypeError for text that is not a URL, which has no host.
    if (error instanceof TypeError) return undefined;
    throw error;
  }
  return parsed.hostname === "" ? undefined : parsed.hostname;
}
