// Whether the browser-imports rule's entry lists still describe the bundle.
//
// The structure audit's browser-imports rule (scripts/structure-audit/rules/
// browser-imports.mjs, mirrored from FluxIQ Core) walks the import graph from
// configured entries, in both repositories. A walk from the wrong entries
// passes the modules it never reaches, so the lists are checked here against
// the bundle itself, from esbuild's metafile:
//
// - this repository's `browserBundles.entries` must be exactly the sources of
//   the entries the extension bundles;
// - every Core module the bundle enters Core through (an import edge from a
//   file outside Core to a file inside it) must be in Core's own
//   `browserBundles.entries`, read as source: `packages/<p>/dist/x.js` is
//   `packages/<p>/src/x.ts`.
//
// On 2026-09-30 a Core parking module imported `node:crypto`, reached through
// the modules below `automation-studio/nodes`. Core's rule catches that class
// in Core's own check only while Core knows the bundle enters there.

import path from "node:path";

/**
 * @param {{
 *   metafiles: Array<{ inputs: Record<string, { imports: Array<{ path: string, external?: boolean }> }> }>,
 *   workingDirectory: string, repoRoot: string, coreRoot: string,
 *   bundledEntrySources: string[], repositoryEntries: string[], coreEntries: string[] | undefined
 * }} options paths in `metafiles` are relative to `workingDirectory`; entries are repository-relative POSIX
 * @returns {string[]} one line per drift, empty when both lists describe the bundle
 */
export function browserEntryDrift({ metafiles, workingDirectory, repoRoot, coreRoot, bundledEntrySources, repositoryEntries, coreEntries }) {
  const problems = [];
  const bundled = new Set(bundledEntrySources.map((file) => posixRelative(repoRoot, file)));
  const declared = new Set(repositoryEntries);
  for (const entry of bundled) {
    if (!declared.has(entry)) problems.push(`the extension bundles ${entry}, but scripts/structure-audit/config.mjs browserBundles.entries does not list it, so the browser-imports rule never walks from it.`);
  }
  for (const entry of declared) {
    if (!bundled.has(entry)) problems.push(`scripts/structure-audit/config.mjs browserBundles.entries lists ${entry}, which the extension does not bundle.`);
  }

  if (coreEntries === undefined) {
    problems.push(`FluxIQ Core at ${coreRoot} declares no browserBundles.entries in scripts/structure-audit/config.mjs, so Core's own check cannot hold the modules this bundle loads. Update Core.`);
    return problems;
  }
  const coreDeclared = new Set(coreEntries);
  const reported = new Set();
  for (const metafile of metafiles) {
    for (const [input, { imports }] of Object.entries(metafile.inputs)) {
      const importer = path.resolve(workingDirectory, input);
      if (inside(coreRoot, importer)) continue;
      for (const edge of imports) {
        if (edge.external) continue;
        const target = path.resolve(workingDirectory, edge.path);
        if (!inside(coreRoot, target)) continue;
        const source = coreSource(posixRelative(coreRoot, target));
        if (coreDeclared.has(source) || reported.has(source)) continue;
        reported.add(source);
        problems.push(`the extension bundle enters FluxIQ Core through ${source} (imported by ${posixRelative(repoRoot, importer)}), which Core's scripts/structure-audit/config.mjs browserBundles.entries does not list, so Core's browser-imports rule never walks from it. Add it there, in Core.`);
      }
    }
  }
  return problems;
}

/** `packages/<p>/dist/x.js` -> `packages/<p>/src/x.ts`; a source path is returned as it is. */
function coreSource(relative) {
  const match = /^(packages\/[^/]+)\/dist\/(.+)\.js$/u.exec(relative);
  return match ? `${match[1]}/src/${match[2]}.ts` : relative;
}

function posixRelative(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function inside(root, file) {
  const relative = path.relative(root, file);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}
