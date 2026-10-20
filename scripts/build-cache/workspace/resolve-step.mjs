// One registry entry of this repository turned into what Core's engine decides
// from: the roots its fingerprint hashes, the outputs its digest covers, the
// files a reuse requires and where its stamp lives, in the shape Core's
// `scripts/build-cache/workspace/resolve-step.mjs` documents. This is the
// resolver `repository.mjs` hands the engine; the engine passes it the root
// and registry to use.
//
// Input roots, in the order they are labelled:
//   - the package's git-visible files, minus the directories its own builds
//     generate and minus this step's resolved outputs;
//   - every workspace package it depends on, transitively, and every package
//     the registry says it `reads` without declaring it, with theirs: the
//     package's git-visible files, and the generated directories its steps
//     write (`dist/` when none is registered), walked on disk because git
//     ignores them and they are exactly what this step reads of it;
//   - every FluxIQ Core package it links, transitively (`core-packages.mjs`):
//     `src`, `dist`, `package.json` and `tsconfig*.json`, plus Core's root
//     `package.json`, `tsconfig*.json`, `pnpm-lock.yaml` and installed
//     `node_modules/.pnpm/lock.yaml`;
//   - this repository's `package.json`, `pnpm-workspace.yaml`,
//     `pnpm-lock.yaml`, `tsconfig.base.json` and installed
//     `node_modules/.pnpm/lock.yaml`;
//   - for a step marked `structureAudit`, the structure audit's configuration
//     and rules (`scripts/structure-audit/`, minus its tests) in this
//     repository and in every Core it links. `extension:check` holds the
//     browser-imports rule's entry lists in both `config.mjs` files to the
//     bundle, so an edit to either alone has to rerun it;
//   - the build-cache sources, this repository's and Core's engine
//     (`engine-sources.mjs`).
// Installed packages are not walked; the two lockfiles stand for them, which
// is what `pnpm install --frozen-lockfile` guarantees.
//
// Git-visible means tracked, or untracked and not ignored, so the run data,
// test builds and Lab instances written into ignored directories of a package
// never reach a fingerprint. Anything outside this checkout -- a linked Core,
// the engine -- is walked, and labelled by its place in its own tree.
//
// A dependency's outputs that a registry step marks `unreadByDependants` (the
// web panel host bundle, which only a running Lab loads) are left out of its
// dependants' roots, so building it does not invalidate every step above it.
//
// Labels are paths relative to the repository (or `core:` + a path relative to
// Core), and an environment value that is an absolute path is fingerprinted
// relative to the repository, so a fingerprint does not depend on where the
// checkout sits: the same inputs in two checkouts give the same fingerprint,
// which is what lets the shared store hand one tree's result to another.
// `relocationRoots` are the absolute directories an output must not mention
// to be stored for any tree: this checkout and the Core roots it links, whose
// installs `installRoots` also names for the coverage proof.

import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { coreEngine } from "../core-engine.mjs";
import { linkedCorePackages } from "./core-packages.mjs";
import { engineSourceRoots } from "./engine-sources.mjs";

const REPOSITORY_FILES = ["package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml", "tsconfig.base.json"];
const INSTALLED_LOCKFILE = "node_modules/.pnpm/lock.yaml";
const CORE_ROOT_FILES = ["package.json", "pnpm-lock.yaml", "node_modules/.pnpm/lock.yaml"];
const STRUCTURE_AUDIT = ["scripts", "structure-audit"];
const STRUCTURE_AUDIT_TESTS = [["tests"], ["rules", "tests"]];
const DEFAULT_GENERATED = ["dist"];
const TSCONFIG = /^tsconfig.*\.json$/u;
const CACHE_DIRECTORY = path.join("node_modules", ".cache", "fluxiq-build");
const STAT_CACHE_FILE = "stat-cache.json";

/**
 * @param {string} stepName a key of the registry, e.g. "domain:build"
 * @param {{ repoRoot: string, steps: Record<string, object>, env?: NodeJS.ProcessEnv }} options
 */
export function resolveExtensionStep(stepName, options) {
  const repoRoot = path.resolve(options.repoRoot);
  const env = options.env ?? process.env;
  const steps = options.steps;
  const step = Object.hasOwn(steps, stepName) ? steps[stepName] : undefined;
  if (step === undefined) throw new Error(`build-cache: unknown step "${stepName}"; registered steps are ${Object.keys(steps).join(", ")}`);
  if (step.command.includes('"')) throw new Error(`build-cache: the command of "${stepName}" contains a double quote, which cannot pass through the package.json script as one argument`);

  const packageDir = path.join(repoRoot, step.package);
  const packages = coreEngine.readWorkspacePackages(repoRoot);
  const own = [...packages.values()].find((candidate) => samePath(candidate.dir, packageDir));
  if (own === undefined) throw new Error(`build-cache: "${stepName}" names ${step.package}, which is not a package of the workspace at ${repoRoot}`);

  const outputBase = resolveOutputBase(step, packageDir, env);
  const outputs = (step.outputs ?? []).map((output) => ({
    label: label(repoRoot, path.join(outputBase.dir, output.path)),
    path: path.join(outputBase.dir, output.path),
    exclude: [],
    match: output.match ?? null
  }));

  const roots = [];
  const git = (target, exclude = []) => roots.push({ kind: "git", label: label(repoRoot, target), path: target, exclude });
  const walk = (target, extra = {}) =>
    roots.push({ kind: "walk", label: extra.labelBase ?? label(repoRoot, target), path: target, exclude: extra.exclude ?? [], ...(extra.labelBase === undefined ? {} : { labelBase: extra.labelBase }) });

  git(packageDir, [...(step.generated ?? []).map((dir) => path.join(packageDir, dir)), ...outputs.map((output) => output.path)]);
  const reads = (step.reads ?? []).map((dir) => {
    const read = [...packages.values()].find((candidate) => samePath(candidate.dir, path.join(repoRoot, dir)));
    if (read === undefined) throw new Error(`build-cache: "${stepName}" reads ${dir}, which is not a package of the workspace at ${repoRoot}`);
    return read.name;
  });
  const dependencies = transitiveDependencies(own, packages, reads);
  const unread = unreadOutputs(steps, repoRoot);
  for (const dependency of dependencies) {
    const unreadHere = unread.filter((output) => samePath(output.packageDir, dependency.dir)).map((output) => output.path);
    git(dependency.dir, unreadHere);
    for (const generated of generatedOf(steps, repoRoot, dependency.dir)) walk(generated, { exclude: unreadHere });
  }

  const corePackages = linkedCorePackages([own, ...dependencies].flatMap((item) => item.links));
  const coreRoots = new Set();
  for (const core of corePackages) {
    const base = core.coreRoot ?? path.dirname(core.dir);
    const prefix = core.coreRoot === null ? "link:" : "core:";
    for (const entry of ["src", "dist", "package.json", ...tsconfigsIn(core.dir)]) {
      const target = path.join(core.dir, entry);
      walk(target, { labelBase: `${prefix}${label(base, target)}` });
    }
    if (core.coreRoot !== null) coreRoots.add(core.coreRoot);
  }
  const sortedCoreRoots = [...coreRoots].sort();
  for (const coreRoot of sortedCoreRoots) {
    for (const file of [...CORE_ROOT_FILES, ...tsconfigsIn(coreRoot)]) walk(path.join(coreRoot, file), { labelBase: `core:${file}` });
  }
  for (const file of REPOSITORY_FILES) git(path.join(repoRoot, file));
  walk(path.join(repoRoot, INSTALLED_LOCKFILE));
  if (step.structureAudit === true) {
    const audit = path.join(repoRoot, ...STRUCTURE_AUDIT);
    git(audit, auditTests(audit));
    for (const coreRoot of sortedCoreRoots) {
      const coreAudit = path.join(coreRoot, ...STRUCTURE_AUDIT);
      walk(coreAudit, { labelBase: `core:${STRUCTURE_AUDIT.join("/")}`, exclude: auditTests(coreAudit) });
    }
  }
  roots.push(...engineSourceRoots());

  const stepPart = stepName.slice(stepName.indexOf(":") + 1);
  const suffix = outputBase.isDefault ? "" : `-${createHash("sha256").update(label(repoRoot, outputBase.dir)).digest("hex").slice(0, 12)}`;

  return {
    name: stepName,
    kind: step.kind,
    command: step.command,
    repoRoot,
    packageDir,
    packageName: own.name,
    dependencies: dependencies.map((dependency) => dependency.name),
    roots,
    outputs,
    outputBase: outputBase.dir,
    required: (step.required ?? []).map((file) => path.join(outputBase.dir, file)),
    tsconfigs: (step.tsconfigs ?? []).map((file) => path.join(packageDir, file)),
    bundles: step.bundles === true,
    traces: false,
    replayOutput: false,
    stampPath: path.join(packageDir, CACHE_DIRECTORY, `${stepPart}${suffix}.json`),
    statCachePath: path.join(repoRoot, CACHE_DIRECTORY, STAT_CACHE_FILE),
    relocationRoots: [repoRoot, ...sortedCoreRoots],
    installRoots: [repoRoot, ...sortedCoreRoots],
    meta: {
      version: coreEngine.STAMP_VERSION,
      step: stepName,
      command: step.command,
      node: process.version,
      platform: process.platform,
      env: Object.fromEntries((step.env ?? []).map((name) => [name, locationFree(env[name] ?? null, repoRoot)])),
      outputs: outputs.map((output) => output.label)
    }
  };
}

function resolveOutputBase(step, packageDir, env) {
  const base = step.outputBase ?? { default: "." };
  const fallback = path.join(packageDir, base.default);
  const raw = base.env ? env[base.env] : undefined;
  const value = typeof raw === "string" && base.trim ? raw.trim() : raw;
  const dir = typeof value === "string" && value.trim() !== "" ? path.resolve(packageDir, value) : fallback;
  return { dir, isDefault: samePath(dir, fallback) };
}

/** The directories a package's registered steps generate, at their default location. */
function generatedOf(steps, repoRoot, packageDir) {
  const found = new Set();
  for (const step of Object.values(steps)) {
    if (!samePath(path.join(repoRoot, step.package), packageDir)) continue;
    for (const dir of step.generated ?? []) found.add(dir);
  }
  return [...(found.size === 0 ? DEFAULT_GENERATED : [...found].sort())].map((dir) => path.join(packageDir, dir));
}

/** The default-location outputs of every step whose outputs no dependant reads. */
function unreadOutputs(steps, repoRoot) {
  return Object.values(steps)
    .filter((step) => step.unreadByDependants === true)
    .flatMap((step) => {
      const packageDir = path.join(repoRoot, step.package);
      const base = path.join(packageDir, (step.outputBase ?? { default: "." }).default);
      return (step.outputs ?? []).map((output) => ({ packageDir, path: path.join(base, output.path) }));
    });
}

/**
 * An environment value as it is fingerprinted: an absolute path becomes the
 * path relative to the repository, so the same setting in two checkouts is
 * the same input; anything else is kept as it is.
 */
function locationFree(value, repoRoot) {
  if (typeof value !== "string" || value.trim() === "" || !path.isAbsolute(value.trim())) return value;
  return `<repository>/${label(repoRoot, path.resolve(value.trim()))}`;
}

function transitiveDependencies(own, packages, reads) {
  const found = new Map();
  const pending = [...own.workspaceDeps, ...reads];
  while (pending.length > 0) {
    const name = pending.pop();
    if (found.has(name) || name === own.name) continue;
    const dependency = packages.get(name);
    if (dependency === undefined) throw new Error(`build-cache: ${own.name} depends on workspace package ${name}, which the workspace does not contain`);
    found.set(name, dependency);
    pending.push(...dependency.workspaceDeps);
  }
  return [...found.values()].sort((left, right) => (left.dir < right.dir ? -1 : left.dir > right.dir ? 1 : 0));
}

/** A structure audit's tests, which no step reads. */
function auditTests(dir) {
  return STRUCTURE_AUDIT_TESTS.map((parts) => path.join(dir, ...parts));
}

function tsconfigsIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && TSCONFIG.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function label(base, target) {
  const relative = path.relative(base, target);
  return (relative === "" ? "." : relative).split(path.sep).join("/");
}

function samePath(left, right) {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}
