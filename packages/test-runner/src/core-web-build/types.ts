// Shapes shared across the cached production build of Core's web panel.

/** Everything a published build depends on. A change to any of them yields a different build key. */
export type CoreWebBuildInputs = {
  /** `git rev-parse HEAD` of the Core checkout. */
  coreHead: string;
  /** Content hash of the `apps/web` entries the staged workspace copies, and of Core's `tsconfig.base.json`. */
  webSourceHash: string;
  /** Content hash of each built Core package the panel consumes, by package directory name. */
  packageDistHashes: Readonly<Record<string, string>>;
  /** The exact `next.config.mjs` text the staged workspace receives. */
  nextConfig: string;
  /** The version of the `next` package installed for Core's web app. */
  nextVersion: string;
};

/** One complete, published production build of Core's web panel. */
export type CoreWebBuild = {
  key: string;
  /** The staged Core workspace the build ran in. It is never moved, so paths the build recorded stay valid. */
  directory: string;
  /** `<directory>/apps/web`, the directory `next start` serves from. */
  webDirectory: string;
  /** The Next executable of Core's own installation. */
  nextExecutable: string;
  /** The `.next/BUILD_ID` the completion marker recorded. */
  buildId: string;
};
