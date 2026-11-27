// The path a marked target says it always led to (`./index.ts`, t1071 F1).

import { NO_BASE } from "./no-base";

/**
 * The path a marked target says it always led to, or nothing when it names none
 * (header). The domain writes it as a path from the site's root, never as an
 * address: a recording's link carries its whole address (`describe-element.ts`),
 * and a recorded read of a link is not a target whose words were seen changing.
 */
export function recordedDestination(target: { href?: string | undefined }): string | undefined {
  const href = target.href?.trim();
  if (!href?.startsWith("/") || href.startsWith("//") || !URL.canParse(href, NO_BASE)) return undefined;
  const url = new URL(href, NO_BASE);
  return url.protocol === "http:" || url.protocol === "https:" ? url.pathname : undefined;
}
