import { findLazyModules } from "./find-lazy-modules.mjs";

/**
 * Fails a bundle build when esbuild set any module to start lazily.
 *
 * A lazily started module is safe only while every importer calls its start
 * function first. esbuild (0.24 and 0.25) drops that call when the import
 * passes through a side-effect-free `export *` file, such as a
 * `"sideEffects": false` package's barrel, so the importer reads exports that
 * do not exist yet. Whether that happens depends on which modules a dynamic
 * import reaches and in what order, so an unrelated change in Core can turn a
 * working bundle into one that crashes as it loads. On 2026-11-17 the domain
 * setup bundle crashed this way: `IAM_PREDEFINED_POLICIES` was undefined.
 *
 * The fix is a build in which nothing starts lazily: split ESM bundles into
 * chunks (`splitting: true`), so each dynamic import stays a real import, or
 * keep the dynamically imported package external.
 *
 * @param {string} label what was built, named in the message
 * @param {readonly { file: string, text: string }[]} bundles the bundle's JavaScript outputs
 */
export function assertEagerBundle(label, bundles) {
  const found = [];
  for (const bundle of bundles) {
    for (const module of findLazyModules(bundle.text)) found.push(`${module} (in ${bundle.file})`);
  }
  if (found.length === 0) return;
  const sample = found.slice(0, 5).map((entry) => `  ${entry}`).join("\n");
  const more = found.length > 5 ? `\n  ...and ${found.length - 5} more` : "";
  throw new Error(
    `${label}: esbuild set ${found.length} module(s) to start lazily, because a dynamic import() or require() in the bundle reaches them:\n${sample}${more}\n` +
      "esbuild drops a lazy module's start call when it is imported through a side-effect-free `export *` file, so the bundle can read exports before they exist. " +
      "Split the bundle into chunks (`splitting: true`) or keep the dynamically imported package external. See scripts/check/lazy-modules/assert-eager-bundle.mjs."
  );
}
