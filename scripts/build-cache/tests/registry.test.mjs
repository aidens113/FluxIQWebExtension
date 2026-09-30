// The registry against the real repository: every path a registered step's
// projects and bundles name is inside that step's fingerprint, and every
// package script runs its build and check through the cache with the
// registered command. The expensive counterpart, which asks tsc and esbuild
// what they actually load, is `prove-inputs.mjs`.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { buildOrder, isInsideRoots, pathSpellings, readWorkspacePackages, REPOSITORY_ROOT, resolveStep, STEPS, tsconfigReferences } from "../index.mjs";

const relative = (file) => path.relative(REPOSITORY_ROOT, file).split(path.sep).join("/");
const packages = [...readWorkspacePackages(REPOSITORY_ROOT).values()].map((pkg) => ({ ...pkg, relative: relative(pkg.dir) }));
const CLI_CALL = /node (\S*scripts\/build-cache\/cli\.mjs) (\S+)(?: -- "([^"]*)")?/gu;

test("every registered step resolves, and names projects that exist", () => {
  for (const [name, step] of Object.entries(STEPS)) {
    const resolved = resolveStep(name, { env: {} });
    assert.ok(existsSync(resolved.packageDir), `${name}: ${step.package} does not exist`);
    for (const config of resolved.tsconfigs) assert.ok(existsSync(config), `${name}: ${relative(config)} does not exist`);
  }
});

test("every tsconfig path a step's projects name is inside that step's fingerprint", () => {
  const outside = [];
  for (const name of Object.keys(STEPS)) {
    const resolved = resolveStep(name, { env: {} });
    for (const config of resolved.tsconfigs) {
      for (const reference of tsconfigReferences(config)) {
        if (!isInsideRoots(reference.path, resolved)) outside.push(`${name}: ${relative(reference.config)} ${reference.field} "${reference.value}" -> ${reference.path}`);
      }
    }
  }
  assert.deepEqual(outside, []);
});

test("every project a step's command compiles is one the registry lists", () => {
  for (const [name, step] of Object.entries(STEPS)) {
    for (const [, project] of step.command.matchAll(/\btsc -p (\S+)/gu)) {
      assert.ok(step.tsconfigs.includes(project), `${name} compiles ${project}, which its tsconfigs do not list`);
    }
  }
});

test("every esbuild entry and alias target is inside the bundling steps' fingerprints", async () => {
  const { EXTENSION_BUNDLE_SOURCES } = await import(pathToFileURL(path.join(REPOSITORY_ROOT, "apps/extension/scripts/build-extension.mjs")).href);
  const sources = [...EXTENSION_BUNDLE_SOURCES.entries, ...Object.values(EXTENSION_BUNDLE_SOURCES.aliases)];
  for (const file of sources) assert.ok(existsSync(file), `bundle source ${file} does not exist`);
  for (const [name, step] of Object.entries(STEPS)) {
    if (!step.bundles) continue;
    const resolved = resolveStep(name, { env: {} });
    for (const file of sources) assert.ok(isInsideRoots(file, resolved), `${name}: esbuild reads ${file}, which no input root covers`);
  }
});

test("every package build and check script goes through the cache with the registered command", () => {
  for (const pkg of packages) {
    const scripts = JSON.parse(readFileSync(path.join(pkg.dir, "package.json"), "utf8")).scripts ?? {};
    for (const kind of ["build", "check"]) {
      if (scripts[kind] === undefined) continue;
      const stepName = Object.keys(STEPS).find((name) => STEPS[name].package === pkg.relative && STEPS[name].kind === kind && name.endsWith(`:${kind}`));
      assert.ok(stepName, `${pkg.relative} has a ${kind} script but no registered ${kind} step`);
      assert.doesNotMatch(scripts[kind], /\bpnpm\b/u, `${pkg.relative} ${kind} runs a nested pnpm`);
      assert.ok(scripts[kind].includes(`cli.mjs ${stepName} -- "${STEPS[stepName].command}"`), `${pkg.relative} ${kind} does not run ${stepName} with its registered command:\n  ${scripts[kind]}`);
    }
    for (const [script, text] of Object.entries(scripts)) {
      for (const [, cli, stepName, command] of text.matchAll(CLI_CALL)) {
        assert.ok(Object.hasOwn(STEPS, stepName), `${pkg.relative} ${script} names unknown step ${stepName}`);
        assert.equal(path.resolve(pkg.dir, cli), path.join(REPOSITORY_ROOT, "scripts", "build-cache", "cli.mjs"), `${pkg.relative} ${script}: ${cli} is not the cache CLI`);
        if (command !== undefined) assert.equal(command, STEPS[stepName].command, `${pkg.relative} ${script} passes ${stepName} a command the registry does not hold`);
      }
    }
  }
});

test("every registered step belongs to a workspace package", () => {
  for (const [name, step] of Object.entries(STEPS)) {
    assert.ok(packages.some((pkg) => pkg.relative === step.package), `${name}: ${step.package} is not a workspace package`);
    assert.match(name, new RegExp(`:(?:[a-z0-9]+-)*${step.kind}$`, "u"), `${name}: a ${step.kind} step must be named <package>:${step.kind} or <package>:<what>-${step.kind}`);
  }
});

test("the test-runner build order puts every workspace dependency first", () => {
  const order = buildOrder("test-runner:build");
  assert.equal(order.at(-1), "test-runner:build");
  for (const dependency of ["domain:build", "test-contracts:build", "test-evidence:build"]) {
    assert.ok(order.includes(dependency), `${dependency} missing from ${order.join(", ")}`);
  }
  assert.ok(order.indexOf("test-contracts:build") < order.indexOf("test-evidence:build"), order.join(", "));
});

test("domain's host:build script runs the host step, which no dependant's fingerprint reads", () => {
  const scripts = JSON.parse(readFileSync(path.join(REPOSITORY_ROOT, "domain", "package.json"), "utf8")).scripts;
  assert.equal(scripts["host:build"], `node ../scripts/build-cache/cli.mjs domain:host-build -- "${STEPS["domain:host-build"].command}"`);
  const host = path.join(REPOSITORY_ROOT, "domain", "dist", "host", "web-panel-host.mjs");
  assert.equal(isInsideRoots(host, resolveStep("domain:host-build", { env: {} })), false, "the host step's own output is not its input");
  for (const dependant of ["extension:build", "extension:check", "test-runner:build", "test-runner:check"]) {
    const resolved = resolveStep(dependant, { env: {} });
    assert.equal(isInsideRoots(host, resolved), false, `${dependant} fingerprints the host bundle`);
    assert.equal(isInsideRoots(path.join(REPOSITORY_ROOT, "domain", "dist", "index.d.ts"), resolved), true, `${dependant} no longer fingerprints domain's dist`);
  }
  assert.ok(!buildOrder("test-runner:build").includes("domain:host-build"), "pnpm build does not run the host step");
});

test("no fingerprinted metadata or label of any step holds an absolute path", () => {
  const cores = [...new Set(Object.keys(STEPS).flatMap((name) => resolveStep(name, { env: {} }).relocationRoots))];
  const spellings = pathSpellings(cores);
  // An absolute build root, as the Lab sets it, must be fingerprinted relative to the tree.
  const env = { NODE_ENV: "production", FLUXIQ_LAB_EXTENSION_BUILD_ROOT: path.join(REPOSITORY_ROOT, "apps", "extension", ".lab-instances", "one"), FLUXIQ_LAB_SCENARIO_OUT_DIR: path.join(REPOSITORY_ROOT, "apps", "scenario-lab", ".lab-instances", "one", "dist") };
  for (const name of Object.keys(STEPS)) {
    const resolved = resolveStep(name, { env });
    const fingerprinted = JSON.stringify({ meta: resolved.meta, roots: resolved.roots.map((root) => root.label) }).toLowerCase();
    for (const spelling of spellings) assert.ok(!fingerprinted.includes(spelling), `${name} fingerprints ${spelling}`);
  }
});
