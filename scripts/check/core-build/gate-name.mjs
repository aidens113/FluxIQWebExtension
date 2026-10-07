// The command a Core-build refusal is refusing, in the words the reader typed.
//
// The gate runs first in every downstream `build`, `check` and `test` script of
// a package that links Core (`tests/package-gates.test.mjs`), so "run pnpm
// check again" would be wrong for most of them. pnpm names the running script
// and its package in `npm_lifecycle_event` and `npm_package_name`.

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {string} rootPackageName this repository's root package.json name
 * @returns {string} e.g. `pnpm --filter @fluxiq-web-extension/domain build`, or `pnpm check`
 */
export function gateName(env, rootPackageName) {
  const event = env.npm_lifecycle_event;
  if (!event) return "pnpm check";
  const name = env.npm_package_name;
  if (!name || name === rootPackageName) return `pnpm ${event}`;
  return `pnpm --filter ${name} ${event}`;
}
