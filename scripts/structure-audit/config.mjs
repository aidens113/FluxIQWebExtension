// Repository-specific configuration for structure-audit. This is the only
// file that differs between FluxIQ Core and this downstream web-extension
// repository; the entry point, context, baseline, and rules are mirrored
// from F:\!FluxIQ\scripts\structure-audit and must be changed there first.

export const CONFIG = {
  repository: "web-extension",

  // Directories whose basename marks a test root. Test files must live
  // directly inside one of these. "e2e" is a runner-owned root, not
  // co-location.
  testRootDirNames: ["tests", "e2e"],

  // Import specifiers that must never appear in this repository's sources.
  forbiddenImports: [],

  // Directory-scoped import boundaries: files under `from` must not import
  // anything resolving under `to`. AGENTS.md: domain code must not depend on
  // extension UI or browser implementation modules.
  importBoundaries: [
    {
      from: "domain/src",
      to: "apps/extension/src",
      reason: "domain code must not depend on extension UI or browser implementation modules."
    }
  ],

  // Path prefixes exempt from the depth limit because a framework dictates
  // their layout. None here; Core exempts its Next.js app router.
  depthExemptPrefixes: [],

  // Filenames (without extension) and directory names that name nothing.
  bannedBasenames: ["utils", "helpers", "misc", "common", "shared-ui"],
  bannedDirectoryNames: ["utils", "helpers", "misc", "common"],

  workingDocsDir: "docs/working",
  workingDocsIndexKind: "ext"
};
