// The verdict a caller acts on: has FluxIQ Core been built at all?
//
// A different question from `stale.mjs`, and deliberately a different function.
// Staleness compares two builds' ages and has no answer for a build that does
// not exist, which is why it says "not stale" when `dist` is absent. This one
// answers exactly that case, so the two together cover a Core that is missing,
// one that is half built, and one that is built from old source.
//
// Refusing here is a SETUP failure, never a run result. A run against a Core
// whose compiled entry points are missing can only die on "Cannot find module",
// and until now that death was recorded as the product failing. The message
// names the command that fixes it, because the one thing a person needs from
// this refusal is what to type.

/**
 * @typedef {import("./entries.mjs").CoreBuildEntries} CoreBuildEntries
 * @typedef {"built" | "not-found" | "unbuilt" | "incomplete"} CoreBuildState
 */

/**
 * @param {CoreBuildEntries} scan
 * @returns {{ built: boolean, state: CoreBuildState, missing: { package: string, paths: string[] }[], command: string, message: string | null }}
 */
export function coreBuildMissing(scan) {
  // Core's own root build: its libraries in dependency order, then its web
  // panel. Its dependencies have to be installed before anything builds.
  const command = scan.installed ? "pnpm build" : "pnpm install --frozen-lockfile && pnpm build";
  const where = `in ${scan.coreRoot}`;
  const consequence = "The Lab runs FluxIQ Core's COMPILED output, so a run now could only die on a missing module, and that would be recorded as a product failure. This is a setup failure, not a run result; nothing has been run.";

  if (!scan.packagesFound || scan.packages.length === 0) {
    return {
      built: false, state: "not-found", missing: [], command,
      message: `No FluxIQ Core was found at ${scan.coreRoot}: it has no packages/*/package.json declaring a build. The Lab loads Core from the checkout beside this repository, or from FLUXIQ_CORE_ROOT when that is set. ${consequence} Check out Core there, then build it with: ${command} (${where}).`
    };
  }

  const missing = scan.packages.filter(item => item.missing.length > 0).map(item => ({ package: item.name, paths: item.missing }));
  if (missing.length === 0) return { built: true, state: "built", missing: [], command, message: null };

  const expected = scan.packages.reduce((total, item) => total + item.expected.length, 0);
  const absent = missing.reduce((total, item) => total + item.paths.length, 0);
  const state = absent === expected ? "unbuilt" : "incomplete";
  const first = missing[0];
  const headline = state === "unbuilt"
    ? `FluxIQ Core at ${scan.coreRoot} has not been built: none of the ${expected} compiled entry points its packages declare exist.`
    : `FluxIQ Core at ${scan.coreRoot} is only partly built: ${absent} of the ${expected} compiled entry points its packages declare are missing, across ${missing.map(item => item.package).join(", ")}.`;
  return {
    built: false, state, missing, command,
    message: `${headline} First missing: ${first.package} ${first.paths[0]}. ${consequence} Build Core first with: ${command} (${where}).`
  };
}
