// A closed set of tracking-only query conventions. Never remove arbitrary
// parameters such as id, page, q, src or fbid: those can name distinct items.
const TRACKING_KEYS: ReadonlySet<string> = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
  "fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid", "__tn__"
]);

/** The explicitly requested link identity; raw link and attribute reads never call this. */
export function trackingFreeLinkIdentity(value: URL): string {
  const url = new URL(value.href);
  const parts = url.search.slice(1).split("&");
  const kept = parts.filter((part) => {
    const key = new URLSearchParams(part).keys().next().value ?? "";
    return !TRACKING_KEYS.has(key.toLowerCase()) && !/^__cft__\[\d+\]$/iu.test(key);
  });
  // Preserve the surviving query bytes and order, including signed/encoded
  // meaningful parameters. URLSearchParams.delete would re-encode all of them.
  if (kept.length !== parts.length) url.search = kept.join("&");
  return url.href;
}
