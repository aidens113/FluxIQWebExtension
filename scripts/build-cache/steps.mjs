// Every package build and check the cache may skip, one entry per step.
//
// An entry states only what cannot be derived. The inputs are derived from it
// in `resolve-step.mjs`: the package directory, its transitive workspace
// dependencies' directories (outputs included), the FluxIQ Core packages it
// links and theirs, the root lockfiles and configs, the build-cache sources,
// `process.version`, the command and the environment variables named here.
//
//   package    the package directory, relative to the repository root
//   kind       "build" (has outputs, stamped on success) or "check" (no
//              outputs, stamped only when it passed)
//   command    the shell command, run in the package directory. It must match
//              the `-- <command>` the package.json script passes the CLI, and
//              `tests/registry.test.mjs` fails when the two drift. It may not
//              contain a double quote: package.json passes it as one quoted
//              argument through cmd.exe and sh alike.
//   generated  directories, relative to the package, that its own builds
//              write. They are never inputs of that package's own steps, and
//              always inputs of its dependants'.
//   outputBase where the outputs live when an environment variable moves
//              them (the Lab's per-instance build roots). The variable's
//              effect is the location and nothing else -- `build-extension.mjs`
//              and `build-scenario-lab.mjs` read it only to place the emit --
//              so the resolved location is what is fingerprinted and what
//              names the stamp, and a value that resolves to the default
//              location shares the default stamp.
//   outputs    directories under the output base the step writes; `match`
//              narrows the digest to the files the step itself emits.
//   required   files under the output base that must exist for a reuse.
//   tsconfigs  every TypeScript project the command compiles, relative to the
//              package: what `prove-inputs.mjs` lists and the registry test
//              parses.
//   reads      workspace packages the step's sources import by relative path
//              without declaring them in package.json. `prove-inputs.mjs`
//              finds these; each is an input with its own dependencies.
//   bundles    true when the step also bundles with esbuild, whose aliases the
//              registry test checks and `prove-inputs.mjs` walks.
//   env        environment variables whose value is fingerprinted (an
//              absolute path is fingerprinted relative to the repository).
//   unreadByDependants
//              true when no workspace dependant's build or check reads this
//              step's outputs, so they are left out of dependants' inputs and
//              building it invalidates nothing above it. `prove-inputs.mjs`
//              holds this claim against what tsc and esbuild load.
//
// A package's `build` and `check` scripts are the steps named
// `<package>:build` and `<package>:check`; any other step of the package is
// named `<package>:<what>-build` or `<what>-check` and is run by its own
// script, never by `pnpm build`.

const CACHE = "node_modules/.cache/fluxiq-build";
const TSC_EMIT = /\.(?:js|d\.ts)(?:\.map)?$/;

function checkProject(project, buildInfo, { noEmit = true } = {}) {
  return `tsc -p ${project}${noEmit ? " --noEmit" : ""} --incremental --tsBuildInfoFile ${CACHE}/${buildInfo}.tsbuildinfo`;
}

function library(name, { required = ["dist/index.js"] } = {}) {
  const pkg = `packages/${name}`;
  return {
    [`${name}:build`]: {
      package: pkg,
      kind: "build",
      command: "tsc -p tsconfig.json",
      generated: ["dist"],
      outputs: [{ path: "dist" }],
      required,
      tsconfigs: ["tsconfig.json"],
      env: ["NODE_ENV"]
    },
    [`${name}:check`]: {
      package: pkg,
      kind: "check",
      command: checkProject("tsconfig.json", "check"),
      generated: ["dist"],
      tsconfigs: ["tsconfig.json"],
      env: ["NODE_ENV"]
    }
  };
}

export const STEPS = Object.freeze({
  "domain:build": {
    package: "domain",
    kind: "build",
    command: "node scripts/clean-dist.mjs && tsc -p tsconfig.json && node scripts/rewrite-dist-specifiers.mjs",
    generated: ["dist"],
    // `dist/host/web-panel-host.mjs` is `host:build`'s bundle, which this
    // build deliberately keeps (`clean-dist.mjs`), so only the tsc emit is
    // this step's output.
    outputs: [{ path: "dist", match: TSC_EMIT }],
    required: ["dist/index.js", "dist/index.d.ts"],
    tsconfigs: ["tsconfig.json"],
    env: ["NODE_ENV"]
  },
  "domain:host-build": {
    package: "domain",
    kind: "build",
    // esbuild bundles src/web-panel-host.ts with every FluxIQ package
    // external; `domain`'s own tsc emit in dist/ is not read.
    command: "node scripts/build-web-panel-host.mjs",
    generated: ["dist"],
    outputs: [{ path: "dist/host" }],
    required: ["dist/host/web-panel-host.mjs", "dist/host/web-panel-host.mjs.identity.json"],
    tsconfigs: [],
    // Only a running Lab and the web panel load the host bundle; no
    // dependant's compiler does.
    unreadByDependants: true,
    env: ["NODE_ENV"]
  },
  "domain:check": {
    package: "domain",
    kind: "check",
    command: `${checkProject("tsconfig.json", "check-src")} && ${checkProject("tsconfig.test.json", "check-test", { noEmit: false })}`,
    generated: ["dist"],
    tsconfigs: ["tsconfig.json", "tsconfig.test.json"],
    env: ["NODE_ENV"]
  },
  "extension:build": {
    package: "apps/extension",
    kind: "build",
    command: `${checkProject("tsconfig.json", "build")} && node scripts/build-extension.mjs`,
    generated: ["build", "dist"],
    outputBase: { env: "FLUXIQ_LAB_EXTENSION_BUILD_ROOT", default: ".", trim: false },
    outputs: [{ path: "build" }, { path: "dist" }],
    required: [
      "build/background/index.js",
      "build/content/index.js",
      "dist/chrome/manifest.json",
      "dist/firefox/manifest.json",
      "dist/e2e-chromium/manifest.json",
      "dist/e2e-chromium/background/index.js"
    ],
    tsconfigs: ["tsconfig.json"],
    bundles: true,
    env: ["NODE_ENV"]
  },
  "extension:check": {
    package: "apps/extension",
    kind: "check",
    command: "node scripts/check-extension.mjs",
    generated: ["build", "dist"],
    tsconfigs: ["tsconfig.json", "tsconfig.test.json"],
    // tsconfig.test.json compiles e2e/, whose harness and specs import the
    // scenario lab's sources and test-contracts by relative path.
    reads: ["apps/scenario-lab", "packages/test-contracts"],
    bundles: true,
    // check-extension.mjs holds the browser-imports rule's entry lists in this
    // repository's and Core's scripts/structure-audit/config.mjs to the bundle
    // (browser-entries.mjs), so either changing alone reruns the check.
    structureAudit: true,
    // check-extension.mjs imports build-extension.mjs, which refuses a build
    // root outside the repository at import time, so the raw value can decide
    // whether the check passes.
    env: ["NODE_ENV", "FLUXIQ_LAB_EXTENSION_BUILD_ROOT"]
  },
  "scenario-lab:build": {
    package: "apps/scenario-lab",
    kind: "build",
    command: "node scripts/build-scenario-lab.mjs",
    generated: ["dist"],
    outputBase: { env: "FLUXIQ_LAB_SCENARIO_OUT_DIR", default: "dist", trim: true },
    outputs: [{ path: "." }],
    required: ["server.js", "registry.js"],
    tsconfigs: ["tsconfig.json"],
    env: ["NODE_ENV"]
  },
  "scenario-lab:check": {
    package: "apps/scenario-lab",
    kind: "check",
    command: `${checkProject("tsconfig.json", "check-src")} && ${checkProject("tsconfig.e2e.json", "check-e2e", { noEmit: false })}`,
    generated: ["dist"],
    tsconfigs: ["tsconfig.json", "tsconfig.e2e.json"],
    env: ["NODE_ENV"]
  },
  ...library("agent-orchestrator", { required: ["dist/index.js", "dist/cli.js"] }),
  ...library("boundary-audit", { required: ["dist/index.js", "dist/cli.js"] }),
  ...library("real-site-policy", { required: ["dist/index.js", "dist/cli.js"] }),
  ...library("test-contracts", { required: ["dist/index.js", "dist/index.d.ts"] }),
  ...library("test-evidence", { required: ["dist/index.js", "dist/index.d.ts"] }),
  ...library("test-matrix", { required: ["dist/index.js", "dist/cli.js"] }),
  "test-runner:build": {
    package: "packages/test-runner",
    kind: "build",
    command: "node scripts/clean-dist.mjs && tsc -p tsconfig.json",
    generated: ["dist"],
    outputs: [{ path: "dist" }],
    required: ["dist/index.js", "dist/cli.js"],
    tsconfigs: ["tsconfig.json"],
    env: ["NODE_ENV"]
  },
  "test-runner:check": {
    package: "packages/test-runner",
    kind: "check",
    command: checkProject("tsconfig.json", "check"),
    generated: ["dist"],
    tsconfigs: ["tsconfig.json"],
    env: ["NODE_ENV"]
  }
});
