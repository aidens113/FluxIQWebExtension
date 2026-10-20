// Whether the capture may carry what an address points at: an http(s) address
// of the top document's origin. A cross-origin resource would need the other
// origin's consent to be read (CORS) and is the other site's, not the page's;
// a `blob:` or extension address cannot be requested again offline.

export function isSameOriginAddress(address: string, origin: string): boolean {
  if (!/^https?:/iu.test(address)) return false;
  try {
    return new URL(address).origin === origin;
  } catch (error) {
    // An address the URL parser refuses names nothing that could be fetched.
    if (error instanceof TypeError) return false;
    throw error;
  }
}
