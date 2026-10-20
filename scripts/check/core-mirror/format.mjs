// The text `core-mirror` prints for a comparison: a one-line summary when
// every set is in sync, otherwise each differing path, which side it is on,
// and the remedy.

const SIDE = {
  "differs": "differs between this repository and Core",
  "extension-only": "exists only in this repository",
  "core-only": "exists only in Core"
};

/**
 * @param {{ inSync: boolean, sets: { name: string, files: number, differences: { path: string, kind: string }[] }[] }} result
 * @param {string} coreRoot
 * @returns {string}
 */
export function formatMirrorReport(result, coreRoot) {
  const counts = result.sets.map((set) => `${set.name} (${set.files} files)`).join(", ");
  if (result.inSync) return `core-mirror: ${result.sets.length} mirror set(s) match FluxIQ Core at ${coreRoot}: ${counts}.`;
  const lines = [`core-mirror: mirrors of FluxIQ Core at ${coreRoot} have drifted:`];
  for (const set of result.sets) {
    for (const difference of set.differences) lines.push(`  [${set.name}] ${difference.path} ${SIDE[difference.kind] ?? difference.kind}`);
  }
  lines.push("Remedy: change Core first, then copy the file here; scripts/structure-audit/config.mjs is the only per-repository file.");
  return lines.join("\n");
}
