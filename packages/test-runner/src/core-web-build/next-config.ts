import path from "node:path";

/**
 * The `next.config.mjs` a staged Core web workspace receives in place of
 * Core's own `next.config.ts`: the same `transpilePackages`, and a Turbopack
 * root at the filesystem root the Core checkout and the runs directory share,
 * because the staged workspace links `packages` back into the checkout.
 */
export function generatedNextConfig(fluxiqRepositoryRoot: string): string {
  const commonFilesystemRoot = path.parse(path.resolve(fluxiqRepositoryRoot)).root;
  return [
    "export default {",
    '  transpilePackages: ["fluxiq"],',
    `  turbopack: { root: ${JSON.stringify(commonFilesystemRoot)} },`,
    "};",
    "",
  ].join("\n");
}
