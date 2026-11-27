// The address a marked target says it always led to, path and query (`./index.ts`, t1071 F1, t1079 F1).

import { NO_BASE } from "./no-base";

/**
 * The address a marked target says it always led to -- its path and its query,
 * never its fragment (t1079 F1) -- or nothing when it names none (header). The
 * domain writes it from the site's root, never with an origin: a recording's
 * link carries its whole address (`describe-element.ts`), and a recorded read of
 * a link is not a target whose words were seen changing.
 */
export function recordedDestination(target: { href?: string | undefined }): string | undefined {
  const href = target.href?.trim();
  if (!href?.startsWith("/") || href.startsWith("//") || !URL.canParse(href, NO_BASE)) return undefined;
  const url = new URL(href, NO_BASE);
  return url.protocol === "http:" || url.protocol === "https:" ? `${url.pathname}${url.search}` : undefined;
}
