// How the page view writes a URL (t223, "Links"): short, and exact.
//
// `~` stands for the page's origin plus the longest whole-segment prefix of
// its own path that at least half of the page's same-origin link lines start
// with -- on a store under `/scenarios/everything-store/`, that directory --
// or for the origin alone when no prefix qualifies. A link under `~` prints
// `~` and the rest of its path, query and fragment; another same-origin link
// prints its path, query and fragment; another origin prints in full. Every
// one can be read back to the exact URL the packet holds.

/** The page's `~` and the writer of every URL on it. */
export type WebLlmLinkWriter = {
  /** What `~` stands for: an origin, and perhaps a path prefix with no trailing `/`. */
  base: string;
  /** The URL as the view prints it. A string that is not a URL is printed as it is. */
  write(href: string): string;
};

/** The writer for one page, from its location and the targets of its link lines. */
export function webLlmLinkWriter(location: string, linkHrefs: readonly string[]): WebLlmLinkWriter {
  if (!URL.canParse(location)) return { base: location, write: (href) => href };
  const origin = new URL(location).origin;
  const samePaths = linkHrefs.flatMap((href) => {
    if (!URL.canParse(href)) return [];
    const url = new URL(href);
    return url.origin === origin ? [url.pathname] : [];
  });
  const prefix = pathPrefixes(new URL(location).pathname)
    .find((candidate) => samePaths.length > 0 && samePaths.filter((path) => underPrefix(path, candidate)).length * 2 >= samePaths.length) ?? "";
  return {
    base: `${origin}${prefix}`,
    write(href) {
      if (!URL.canParse(href)) return href;
      const url = new URL(href);
      if (url.origin !== origin || origin === "null") return href;
      // The rest as the packet spelled it, so the written form reads back exactly.
      const rest = href.startsWith(origin) ? href.slice(origin.length) : `${url.pathname}${url.search}${url.hash}`;
      if (prefix === "") return `~${rest}`;
      return underPrefix(url.pathname, prefix) ? `~${rest.slice(prefix.length)}` : rest;
    }
  };
}

/** The path's whole-segment prefixes, longest first, with no trailing `/`: `/a/b/c` gives `/a/b/c`, `/a/b`, `/a`. */
function pathPrefixes(path: string): string[] {
  const segments = path.split("/").filter((segment) => segment !== "");
  return segments.map((_, index) => `/${segments.slice(0, segments.length - index).join("/")}`);
}

function underPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}
