// The path of the address a tab landed on, which is all of that address a
// failure record or a message may quote: the query and the fragment can carry
// what a person searched for, a session or a return address. A click's landing
// (`click-landing.ts`) and a navigation's (`action-runner.ts`) both name a
// refused page by it.

import { parsedUrl } from "../shared/parsed-url";

/** The landed address's path, without the query or fragment a record must not quote; `(unknown)` for an address that does not parse. */
export function landedPath(url: string): string {
  return parsedUrl(url)?.pathname ?? "(unknown)";
}
