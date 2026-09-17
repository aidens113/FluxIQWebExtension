import { realpathSync } from "node:fs";
import { copyFile, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "..", "..");
const fluxiqRoot = path.resolve(repoRoot, "..", "!FluxIQ");
const fluxiqClientGatewayContracts = path.join(fluxiqRoot, "packages", "fluxiq", "src", "client-gateway", "contracts.ts");
const fluxiqFingerprinting = path.join(fluxiqRoot, "packages", "fluxiq", "src", "programs", "automation-studio", "fingerprinting", "index.ts");
const webAutomationDomainClient = path.join(repoRoot, "domain", "src", "client", "index.ts");
// FLUXIQ_LAB_EXTENSION_BUILD_ROOT sends `build/` and `dist/` somewhere this
// build owns, so a concurrent Lab instance cannot delete the unpacked
// extension a running browser is loading. scripts/lab/lab-instance.mjs is the
// only writer of that variable; unset, the paths are the package's own and the
// build behaves exactly as it always has, refreshing the tracked `build/`.
const buildRoot = resolveBuildRoot(process.env.FLUXIQ_LAB_EXTENSION_BUILD_ROOT);
const buildDir = path.join(buildRoot, "build");
const distDir = path.join(buildRoot, "dist");
const placeholderPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAI" +
  "AAAACACAYAAADDPmHLAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAA" +
  "AadJREFUeNrs3cENwjAQRUEj/Rd2gBqogZqogcqogXqohRFhh5QYe77cuZkOAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAwN8k7vO+3+4D+JvjdYAfQAAQAAQAAQAAQAAQAAQAAQAA" +
  "QAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAA" +
  "QAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAA" +
  "QAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAA" +
  "QAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAA" +
  "QAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAA" +
  "QAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAA" +
  "QAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAA" +
  "QAAQAAQAAQAAQAAQAAQAAQAAQAASDU/HAD5WUMR2QAAAABJRU5ErkJggg==";

// `distDir` is deleted on every build, so a build root outside the repository
// is refused rather than trusted.
function resolveBuildRoot(declared) {
  if (!declared || declared.trim() === "") return root;
  const resolved = path.resolve(declared);
  const relative = path.relative(repoRoot, resolved);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`FLUXIQ_LAB_EXTENSION_BUILD_ROOT must name a directory inside ${repoRoot}; received ${resolved}`);
  }
  return resolved;
}

// Every bundle the extension is assembled from, in build order. Keyed so a
// caller outside this script can name one entry: the content-script test
// harness (e2e/content/) bundles "content" and "page-world" through
// bundleExtensionEntry.
//
// "page-world" is the one bundle that runs in the page's own JavaScript world
// (`world: "MAIN"` in each manifest) rather than an isolated one, so that the
// native-dialog override is installed before any page script can capture
// `alert`, `confirm`, or `prompt`. It is a separate entry precisely because it
// must not carry the content script's code into the page.
const extensionEntries = {
  background: { source: "src/background/index.ts", outfile: "background/index.js", format: "esm" },
  content: { source: "src/content/index.ts", outfile: "content/index.js", format: "iife" },
  "page-world": { source: "src/page-world/index.ts", outfile: "page-world/index.js", format: "iife" },
  popup: { source: "src/popup/index.ts", outfile: "popup/index.js", format: "esm" },
  sidepanel: { source: "src/sidepanel/index.ts", outfile: "sidepanel/index.js", format: "esm" }
};

/** Every entry's name, in build order: what `check-extension.mjs` bundles to prove the browser graph. */
export const EXTENSION_ENTRY_NAMES = Object.freeze(Object.keys(extensionEntries));

async function buildTarget(target, manifestName) {
  const out = path.join(distDir, target);
  await mkdir(out, { recursive: true });
  await cp(buildDir, out, { recursive: true });
  await rewriteModuleImports(out);
  await copyStatic("popup", out);
  await copyStatic("sidepanel", out);
  await ensureIcons(path.join(out, "icons"));
  await copyFile(path.join(root, manifestName), path.join(out, "manifest.json"));
}

async function bundleExtension() {
  await rm(buildDir, { recursive: true, force: true });
  for (const name of Object.keys(extensionEntries)) await bundleExtensionEntry(name, buildDir);
}

/**
 * Bundles one extension entry with the extension's own esbuild settings into
 * `outputDir`, at the relative path the extension build uses, and returns the
 * bundle's path. Only the log level, and whether the bundle is written at all,
 * may differ from the extension build, so a caller cannot drift from the bundle
 * the extension ships. `write: false` keeps the bundle in memory: that is how
 * `check-extension.mjs` walks the real import graph without touching `build/`.
 *
 * @param {"background" | "content" | "page-world" | "popup" | "sidepanel"} name
 * @param {string} outputDir
 * @param {{ logLevel?: import("esbuild").LogLevel, write?: boolean }} [options]
 * @returns {Promise<string>}
 */
export async function bundleExtensionEntry(name, outputDir, options = {}) {
  if (!Object.hasOwn(extensionEntries, name)) {
    throw new Error(`Unknown extension entry "${name}"; expected one of ${Object.keys(extensionEntries).join(", ")}.`);
  }
  const entry = extensionEntries[name];
  const outfile = path.join(outputDir, entry.outfile);
  await build({
    bundle: true,
    platform: "browser",
    target: ["chrome109", "firefox109"],
    sourcemap: true,
    legalComments: "none",
    logLevel: options.logLevel ?? "info",
    write: options.write ?? true,
    // The guard goes first so it sees every import, including the ones the
    // workspace plugin answers.
    plugins: [nodeOnlyImportGuardPlugin(name), browserSafeWorkspacePlugin()],
    entryPoints: [path.join(root, entry.source)],
    outfile,
    format: entry.format
  });
  return outfile;
}

const NODE_BUILTINS = new Set(builtinModules.flatMap((name) => name.startsWith("node:") ? [name] : [name, `node:${name}`]));

/** Marks the guard's own look-ahead resolution, so the guard does not recurse into itself. */
const GUARD_LOOKAHEAD = Object.freeze({ nodeOnlyImportGuard: "lookahead" });

/**
 * Fails a browser bundle that reaches a Node built-in, naming the built-in and
 * the chain of imports that reached it from the entry.
 *
 * esbuild already refuses `node:crypto` on the browser platform, but only by
 * naming the file that imports it -- which is deep inside a dependency's
 * compiled output, not the line in this repository that pulled that dependency
 * in. That line is what a developer has to change: on 2026-09-16 a web-domain
 * module value-imported `fluxiq/automation-studio`, whose barrel reaches
 * `node:crypto`, and the domain client barrel carried it into the content
 * script. So every resolved import is recorded against the first file that
 * imported it, and the refusal walks that record back to the entry.
 *
 * Only an import the build could not resolve is refused, so a package whose
 * `browser` field stubs a built-in out still bundles exactly as before. The
 * recording costs a second resolution of each import; it changes nothing the
 * bundle contains.
 *
 * One refusal per crossing. A dependency's barrel can reach a hundred built-in
 * imports, and printing each buried the one line that matters, so the guard
 * refuses the first built-in reached through each import from this repository
 * into a dependency, and lets that crossing's other built-ins through as
 * external: the build has already failed on the first.
 *
 * @param {string} entryName
 * @returns {import("esbuild").Plugin}
 */
function nodeOnlyImportGuardPlugin(entryName) {
  return {
    name: "node-only-import-guard",
    setup(buildContext) {
      /** @type {Map<string, string>} resolved file -> the first file that imported it */
      const importedBy = new Map();
      /** @type {Set<string>} the crossings already refused */
      const refused = new Set();
      buildContext.onResolve({ filter: /.*/ }, async (args) => {
        if (args.pluginData === GUARD_LOOKAHEAD || args.kind === "entry-point") return undefined;
        const resolved = await buildContext.resolve(args.path, {
          kind: args.kind,
          importer: args.importer,
          namespace: args.namespace,
          resolveDir: args.resolveDir,
          pluginData: GUARD_LOOKAHEAD
        });
        if (resolved.errors.length === 0) {
          if (resolved.path && !importedBy.has(resolved.path)) importedBy.set(resolved.path, args.importer);
          return undefined;
        }
        if (!NODE_BUILTINS.has(args.path)) return undefined;
        const chain = importChain(importedBy, args.importer);
        const crossing = repositoryCrossing(chain) ?? `${args.importer} imports ${args.path}`;
        if (refused.has(crossing)) return { path: args.path, external: true };
        refused.add(crossing);
        return { errors: [{ text: nodeOnlyImportMessage(entryName, args.path, chain) }] };
      });
    }
  };
}

/** The files from the entry down to `importer`, entry first, as the first import of each reached it. */
function importChain(importedBy, importer) {
  const chain = [];
  const seen = new Set();
  for (let file = importer; file && !seen.has(file); file = importedBy.get(file)) {
    seen.add(file);
    chain.unshift(file);
  }
  return chain;
}

/** Where `chain` leaves this repository, as "<repository file> imports <dependency file>", or `undefined` when it never does. */
function repositoryCrossing(chain) {
  const outside = chain.findIndex((file) => !isRepositorySource(file));
  return outside > 0 ? `${chain[outside - 1]} imports ${chain[outside]}` : undefined;
}

function isRepositorySource(file) {
  const relative = path.relative(repoRoot, file);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative) &&
    !relative.split(path.sep).includes("node_modules");
}

function nodeOnlyImportMessage(entryName, builtin, chain) {
  const shown = chain.map((file, index) => `${index === 0 ? "   " : "-> "}${path.relative(repoRoot, file).replaceAll("\\", "/")}`);
  return [
    `Node-only module "${builtin}" is reachable from the browser bundle "${entryName}", which cannot load it. Import chain:`,
    ...shown.map((line) => `  ${line}`),
    `  -> ${builtin}`,
    "Find the first file in this chain that belongs to this repository and change its import: take a browser-safe subpath",
    "(for example fluxiq/automation-studio/nodes rather than fluxiq/automation-studio), or make the import type-only.",
    "Other Node-only modules reached through the same import are not listed again."
  ].join("\n");
}

/**
 * Resolves the workspace specifiers a browser bundle may use to the source file
 * behind each, so no bundle depends on a sibling package's compiled output.
 *
 * `fluxiq/client-gateway` is aliased because it has to be: its published entry
 * is the gateway service, which reaches Node built-ins, and only the contracts
 * module inside it is browser-safe.
 *
 * `fluxiq/automation-studio/fingerprinting` is different, and the difference is
 * worth stating. That subpath is browser-safe as published -- its compiled graph
 * is three files with no imports at all, proven by a Core test -- so esbuild
 * would resolve it through the package `exports` map with no help from here. It
 * is aliased anyway so the bundle never reads Core's `dist/`, which Core's own
 * build deletes and rewrites: a Core build running beside a content-harness run
 * would otherwise fail the bundle or feed it half a directory. TypeScript still
 * resolves the same specifier through the `exports` map, so the published
 * subpath is exercised by `pnpm check` rather than taken on trust.
 */
function browserSafeWorkspacePlugin() {
  return {
    name: "browser-safe-workspace-imports",
    setup(buildContext) {
      buildContext.onResolve({ filter: /^@fluxiq-web-extension\/domain\/client$/ }, () => ({
        path: webAutomationDomainClient
      }));
      buildContext.onResolve({ filter: /^fluxiq\/client-gateway$/ }, () => ({
        path: fluxiqClientGatewayContracts
      }));
      buildContext.onResolve({ filter: /^fluxiq\/automation-studio\/fingerprinting$/ }, () => ({
        path: fluxiqFingerprinting
      }));
    }
  };
}

async function copyStatic(folder, out) {
  const source = path.join(root, "src", folder);
  const target = path.join(out, folder);
  await mkdir(target, { recursive: true });
  for (const entry of await readdir(source)) {
    if (entry.endsWith(".html") || entry.endsWith(".css")) {
      await copyFile(path.join(source, entry), path.join(target, entry));
    }
  }
}

async function ensureIcons(iconDir) {
  await mkdir(iconDir, { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    await writeFile(path.join(iconDir, `icon${size}.png`), pngDataUriToBuffer(placeholderPng));
  }
}

function pngDataUriToBuffer(dataUri) {
  return Buffer.from(dataUri.split(",", 2)[1], "base64");
}

async function rewriteModuleImports(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await rewriteModuleImports(fullPath);
      continue;
    }
    if (!entry.name.endsWith(".js")) continue;
    const source = await readFile(fullPath, "utf8");
    const rewritten = source.replace(
      /(from\s+["'])(\.\.?\/[^"']+?)(["'])/g,
      (_match, prefix, specifier, suffix) => `${prefix}${specifier.endsWith(".js") ? specifier : `${specifier}.js`}${suffix}`
    ).replace(
      /(import\s+["'])(\.\.?\/[^"']+?)(["'])/g,
      (_match, prefix, specifier, suffix) => `${prefix}${specifier.endsWith(".js") ? specifier : `${specifier}.js`}${suffix}`
    );
    if (rewritten !== source) await writeFile(fullPath, rewritten, "utf8");
  }
}

async function buildExtension() {
  await rm(distDir, { recursive: true, force: true });
  await bundleExtension();
  await buildTarget("chrome", "manifest.chrome.json");
  await buildTarget("firefox", "manifest.firefox.json");
  await buildTarget("e2e-chromium", "manifest.e2e.json");
}

// Build only when node runs this file. Importing it for bundleExtensionEntry
// must not delete dist/ or rewrite build/. Paths are compared canonically
// because Windows may spell the drive letter either way.
function isEntryPoint() {
  if (!process.argv[1]) return false;
  const canonical = (file) => {
    const resolved = realpathSync(path.resolve(file));
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
  };
  return canonical(fileURLToPath(import.meta.url)) === canonical(process.argv[1]);
}

if (isEntryPoint()) await buildExtension();
