import { readdirSync } from "node:fs";
import path from "node:path";
import { drivesABrowser } from "./drives-a-browser.js";

/** One browser test source in the repository, and why it counts as one. */
export type BrowserTestFile = {
  /** Repository-relative, with `/` separators. */
  readonly relativePath: string;
  /** `playwright-tree`: under a directory holding a Playwright config. `launches-a-browser`: a test file elsewhere that drives a real browser (`drivesABrowser`). */
  readonly why: "playwright-tree" | "launches-a-browser";
};

/** Directories that hold dependencies, build output, run evidence or disposable browser state, never authored tests. */
const SKIPPED_DIRECTORIES = new Set([
  ".git", "node_modules", "dist", "build", "test-runs", "test-results", "playwright-report", ".playwright",
  ".browser-profiles", ".harness-build", ".script-build", ".lab-instances", ".lab-locks", ".fluxiq", ".turbo",
]);
const SOURCE_FILE = /\.(?:ts|mts|cts|tsx|mjs|cjs|js)$/u;
const PLAYWRIGHT_CONFIG = /^playwright(?:\.[\w-]+)*\.config\.(?:ts|mts|cts|mjs|cjs|js)$/u;
/** A test file: under a `tests` folder, or named `*.test.*` / `*.spec.*`. */
const TEST_FILE_NAME = /\.(?:test|spec)\.[^.]+$/u;
function isSkipped(name: string): boolean {
  return SKIPPED_DIRECTORIES.has(name) || name.startsWith(".test-build");
}

/**
 * Every browser test source in the repository, sorted by path: each source
 * file under a directory that holds a Playwright config (the spec tree and its
 * fixtures and kits), and each test file anywhere else that drives a real browser,
 * directly or through a test kit (`drivesABrowser`). The whole repository is walked, so a browser
 * test added anywhere is found without editing a list of roots. Dependencies,
 * build output, run evidence and browser state are skipped.
 */
export function findBrowserTestFiles(repositoryRoot: string): BrowserTestFile[] {
  const found: BrowserTestFile[] = [];
  const drives = new Map<string, boolean>();
  const walk = (directory: string, inPlaywrightTree: boolean, inTests: boolean) => {
    const entries = readdirSync(directory, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const playwrightTree = inPlaywrightTree || entries.some((entry) => entry.isFile() && PLAYWRIGHT_CONFIG.test(entry.name));
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!isSkipped(entry.name)) walk(full, playwrightTree, inTests || entry.name === "tests");
        continue;
      }
      if (!entry.isFile() || !SOURCE_FILE.test(entry.name)) continue;
      const relativePath = path.relative(repositoryRoot, full).replaceAll("\\", "/");
      if (playwrightTree) found.push({ relativePath, why: "playwright-tree" });
      else if ((inTests || TEST_FILE_NAME.test(entry.name)) && drivesABrowser(full, drives)) found.push({ relativePath, why: "launches-a-browser" });
    }
  };
  walk(repositoryRoot, false, false);
  return found.sort((a, b) => (a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0));
}
