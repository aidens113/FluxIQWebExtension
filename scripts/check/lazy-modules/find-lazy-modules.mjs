/**
 * The modules esbuild set to start lazily in one bundle. esbuild wraps a
 * module in `__esm` when a dynamic `import()` or a `require()` inside the
 * bundle reaches it, and writes each wrapper as
 * `var init_<name> = __esm({ "<module path>"() { ... } })`.
 *
 * @param {string} source the bundle's text
 * @returns {string[]} each wrapped module's path, in bundle order
 */
export function findLazyModules(source) {
  const modules = [];
  for (const match of source.matchAll(/__esm\(\{\s*(?:"([^"]*)"|([\w$]+))?/g)) {
    modules.push(match[1] ?? match[2] ?? "(unnamed module)");
  }
  return modules;
}
