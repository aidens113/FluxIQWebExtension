/** The captured URL must belong to this loopback scenario's exact path or a slash descendant. */
export function recordedReadFixtureUrlMatches(value: string, startPath: string): boolean {
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.username || url.password) return false;
  if (!startPath.startsWith("/") || startPath.includes("?") || startPath.includes("#")) return false;
  const base = startPath.replace(/\/+$/u, "") || "/";
  return base === "/" || url.pathname === base || url.pathname.startsWith(`${base}/`);
}
