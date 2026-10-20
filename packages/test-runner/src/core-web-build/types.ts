// Shapes of the Core web build the Lab serves, and of Core's keyed-build
// seam (`<core>/scripts/web-build/index.mjs`) as this package calls it.

/** One complete, published production build of Core's web panel. */
export type CoreWebBuild = {
  key: string;
  /** The attempt directory the build ran in. It is never moved, so paths the build recorded stay valid. */
  directory: string;
  /** `<directory>/apps/web`, the directory `next start` serves from. */
  webDirectory: string;
  /** The Next executable of Core's own installation. */
  nextExecutable: string;
  /** The `.next/BUILD_ID` the completion marker recorded. */
  buildId: string;
};

/** A command Core's seam asks its caller to run: the gateway server generator, or `next build` in a staged attempt. */
export type CoreWebBuildCommand = {
  name: "gateway-server-build" | "web-build";
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  shell: boolean;
};

/** An error Core's seam raises on purpose: `environment` when no build can be made there, `build` when a build was refused. */
export type CoreWebBuildError = Error & { kind: "environment" | "build"; details: Readonly<Record<string, unknown>> };

/** The part of Core's `scripts/web-build/index.mjs` this package calls. */
export type CoreWebBuildSeam = {
  prepareWebBuild(options: {
    repoRoot: string;
    cacheRoot?: string;
    env: NodeJS.ProcessEnv;
    run: (command: CoreWebBuildCommand) => Promise<void>;
    log: (line: string) => void;
    signal?: AbortSignal;
    waitTimeoutMs?: number;
  }): Promise<CoreWebBuild & { reused: boolean }>;
  inspectWebBuild(options: { repoRoot: string; cacheRoot?: string; env: NodeJS.ProcessEnv }): Promise<{ key: string; cached: boolean }>;
};
