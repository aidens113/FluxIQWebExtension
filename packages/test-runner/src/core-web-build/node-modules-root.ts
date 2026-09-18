import path from "node:path";

/**
 * Whether a cache root runs through a `node_modules` directory, where the Core
 * web build cannot be made at all.
 *
 * Turbopack treats a project whose own path runs through `node_modules` as
 * third-party code, and its build worker aborts in the first seconds with exit
 * 3221225501 (0xC000001D) and nothing else in its log (`cache-root.ts` has the
 * measurement). The default location avoids it; this catches an override that
 * does not, so the answer is a sentence naming the directory rather than an
 * exit code that reads as a hardware fault.
 */
export function insideNodeModules(cacheRoot: string): boolean {
  // Separators by name, not by regex: both kinds, whatever platform wrote the path.
  return path.resolve(cacheRoot).replaceAll(path.win32.sep, path.posix.sep).split(path.posix.sep).some(segment => segment.toLowerCase() === "node_modules");
}
