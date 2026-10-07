import { RunnerFailure } from "../failure.js";

/** A `paths` target into a Core package's source tree, such as `packages/fluxiq/src/index.ts`. */
const PACKAGE_SOURCE_TARGET = /^(?:\.\/)?packages\/[^/]+\/src\//u;

type TsconfigBase = Record<string, unknown> & { compilerOptions?: Record<string, unknown> & { paths?: Record<string, unknown> } };

/**
 * The `tsconfig.base.json` a staged Core web workspace receives: Core's own,
 * without the `paths` aliases that send Core's packages to their source.
 *
 * Turbopack honours tsconfig `paths`. With Core's aliases the panel compiled
 * `fluxiq` and `@fluxiq/contracts` from `packages/<name>/src`, whose runtime
 * identity literal is a placeholder that only Core's `dist` build stamps, so
 * every Lab run's identity check answered 400 (t342). Without them the panel
 * resolves `node_modules/fluxiq`, a link to Core's package, whose exports all
 * point at the stamped `dist` -- the same `dist` the build key hashes and the
 * Lab's identity expectation reads. Every other option is kept as Core wrote it.
 */
export function stagedTsconfigBase(text: string): string {
  let config: TsconfigBase;
  try {
    config = JSON.parse(text) as TsconfigBase;
  } catch (cause) {
    throw new RunnerFailure("environment.missing", "Core's tsconfig.base.json is not plain JSON, so its source aliases cannot be removed for the staged panel build", { cause });
  }
  const options = config.compilerOptions;
  if (!options?.paths) return `${JSON.stringify(config, null, 2)}\n`;
  const kept = Object.entries(options.paths).filter(([, targets]) => !intoPackageSource(targets));
  const { paths: _aliases, ...rest } = options;
  const compilerOptions = kept.length > 0 ? { ...rest, paths: Object.fromEntries(kept) } : rest;
  return `${JSON.stringify({ ...config, compilerOptions }, null, 2)}\n`;
}

function intoPackageSource(targets: unknown): boolean {
  return Array.isArray(targets) && targets.some(target => typeof target === "string" && PACKAGE_SOURCE_TARGET.test(target));
}
