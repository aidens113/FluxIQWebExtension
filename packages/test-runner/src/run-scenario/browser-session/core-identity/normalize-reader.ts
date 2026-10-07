/** Matches Core's normalization policy; surrounding executable semantics are hashed. */
export function normalizeRuntimeIdentityReader(source: string): string {
  const slot = /(?<=\/\* core-runtime-identity:start \*\/\s*const embedded = )(['"])(?:\\.|(?!\1)[^\\])*\1(?=;\s*\/\* core-runtime-identity:end \*\/)/gu;
  if ((source.match(/core-runtime-identity:start/gu) ?? []).length !== 1 || (source.match(/core-runtime-identity:end/gu) ?? []).length !== 1 || [...source.matchAll(slot)].length !== 1) throw new Error("Malformed runtime identity payload slot.");
  return source.replace(slot, () => JSON.stringify('{"fluxiqRuntimeIdentityPlaceholder":302}'));
}
