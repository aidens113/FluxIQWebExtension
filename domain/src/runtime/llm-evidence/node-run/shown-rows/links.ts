// How a read writes the links in its rows: from its page's origin.
//
// Live run 13 (`run-muqbzu32-8691a65e`) spent 49,353 of its last request's
// 290,929 characters on absolute addresses, most of them the same
// `http://127.0.0.1:56906` in front of each row's link. So a read writes every
// address on its own page's origin as the path from that origin -- `/dp/B0X1`
// -- and states the origin once, as the read's `origin` (`./account.ts`).
// An address on another origin is written whole, and a value that is no
// address is left as it is. The same writer serves the kept rows and the rows
// the conditions turned down (`../rejected-rows.ts`), so one read states one
// origin.
//
// **Why the path and not the page view's `~`.** The page view writes `~` for
// its origin and a shared directory (`../../page-view/link-writer.ts`), which is
// shorter on the Lab's stores, whose pages all sit under `/scenarios/<store>/`;
// on a real site `~` is the bare origin and the two are the same length. A
// read's links are addresses the model goes on to open, and the rule on where
// a build may navigate remembers what a read showed by reading its rows as
// addresses -- absolute, or written from the site's root, against the page the
// read ran on (`../shown-addresses.ts`). A `~` link is neither, so a product
// page a read listed would have become an address the build "was not shown".
// A path from the origin is both short and still an address.

import type { JsonValue } from "fluxiq/core";

/** One read's link writer: its page's origin, the writing, and whether any link was written short. */
export type WebNodeReadLinks = {
  /** The origin a written path is read from, or nothing when the read named no page. */
  origin: string | undefined;
  /** The value with an address on `origin` written as its path from it; anything else unchanged. */
  write(value: string): string;
  /** Whether any value has been written short. */
  used(): boolean;
};

/** The writer for a read whose page is `location` (the payload's `url`). */
export function webNodeReadLinks(location: JsonValue | undefined): WebNodeReadLinks {
  const origin = typeof location === "string" && isAddress(location) ? new URL(location).origin : undefined;
  let used = false;
  return {
    origin,
    write(value) {
      if (origin === undefined || origin === "null" || !isAddress(value)) return value;
      const url = new URL(value);
      if (url.origin !== origin) return value;
      // The rest as the read spelled it, so the written form reads back exactly.
      const spelled = value.startsWith(origin) ? value.slice(origin.length) : `${url.pathname}${url.search}${url.hash}`;
      const rest = spelled.startsWith("/") ? spelled : `/${spelled}`;
      // `//x` would read as another host's address, so such a path stays whole.
      if (rest.startsWith("//")) return value;
      used = true;
      return rest;
    },
    used: () => used
  };
}

/** An absolute web address, the only kind of value written short. */
function isAddress(value: string): boolean {
  return /^https?:\/\//iu.test(value) && URL.canParse(value);
}
