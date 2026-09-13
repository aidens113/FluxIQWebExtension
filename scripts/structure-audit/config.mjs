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

  // Paths whose files build values that must satisfy an external wire
  // contract, where no property may arrive through a spread. TypeScript runs
  // no excess-property check on a property a spread brings in, so a renamed or
  // deleted contract field leaves the wire with every gate green; that defect
  // shipped three times in the page-evidence contract before anyone noticed,
  // and 46 conditional spreads across the two producers below were removed to
  // close it. Each entry is a directory prefix or a single file, and its
  // `reason` and `remedy` go into the message a developer sees.
  //
  // Deliberately not the whole repository: an object spread is idiomatic and
  // harmless nearly everywhere, and there are ~1,460 of them here. What is out,
  // and why. The rest of `apps/extension/src/background/connection/` assembles
  // gateway payloads, runtime status and recording envelopes rather than the
  // evidence contract, and holds 47 spreads that this change does not touch;
  // `domain/src/client/` (the gateway mapping) and
  // `domain/src/runtime/llm-evidence/` (the sanitized downstream packet) are
  // wire-adjacent but would each need their own cleanup before they could be
  // listed; `apps/extension/src/shared/present.ts` itself builds by iterating
  // entries rather than by literal, so a spread there could not name a contract
  // field; `packages/test-runner/` is harness code that produces no contract.
  //
  // Configure a path only once it is clean. The finding is ratcheted like every
  // other rule's and `--update` never adds an entry, so a dirty path stays red
  // until it is fixed rather than being recorded away.
  contractSpreadPaths: [
    {
      path: "apps/extension/src/content/evidence",
      reason: "this directory is the content script's producer of the page-evidence wire contract",
      remedy: "Write each field by name through `present<T>()` (apps/extension/src/shared/present.ts), which omits the ones that are undefined and makes a deleted field a compile error."
    },
    {
      path: "apps/extension/src/background/connection/dom-snapshot.ts",
      reason: "this file is the second producer of that contract, rebuilding and merging every frame's evidence",
      remedy: "Write each field by name through `present<T>()` (apps/extension/src/shared/present.ts): its parameter type requires every contract key to be mentioned, which is what makes the merge exhaustive."
    },
    {
      path: "domain/src/runtime/llm-evidence",
      reason: "this directory builds the sanitized, bounded packet that is the only page data a language model ever sees, and a field that stops arriving there fails nothing -- the model simply reasons with less",
      remedy: "Write each field by name through `present<T>()` (domain/src/runtime/llm-evidence/present.ts), which omits the ones that are undefined and makes a renamed or deleted field a compile error."
    },
    {
      path: "domain/src/page-evidence",
      reason: "this directory is the contract's own home -- its declaration, its wire reader, and the checked-in captures the producers are measured against",
      remedy: "Write each field by name, so a rename here fails to compile rather than changing what the readers silently accept."
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
