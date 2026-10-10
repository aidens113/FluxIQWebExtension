/**
 * A predicate for "a page asked one of the run's scenario origins for this
 * path": the origin must be one of `origins` exactly, and the path must match
 * `pattern` whole, where `*` stands for any run of characters (including
 * none) and everything else is literal. The query string is ignored.
 */
export function siteRequestMatcher(pattern: string, origins: readonly string[]): (url: string) => boolean {
  const allowed = new Set(origins.map(origin => new URL(origin).origin));
  const expression = new RegExp(`^${pattern.split("*").map(part => part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join(".*")}$`, "u");
  return url => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch (error) {
      if (error instanceof TypeError) return false;
      throw error;
    }
    return allowed.has(parsed.origin) && expression.test(parsed.pathname);
  };
}
