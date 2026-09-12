// Make `dist/` loadable by a plain Node ESM consumer.
//
// `domain/src` is written for a bundler: `tsconfig.base.json` sets
// `moduleResolution: "Bundler"`, so every relative specifier in the source is
// extensionless (`export * from "./constants"`). `tsc` never rewrites a
// specifier, so the emitted `dist/index.js` and `dist/index.d.ts` carry those
// same extensionless paths, and Node ESM refuses them
// (`ERR_MODULE_NOT_FOUND`) exactly as TypeScript's `node16`/`nodenext`
// resolution does (`TS2835`). Every consumer of this package bundled, so it
// never surfaced until `packages/test-runner` -- plain `tsc` + `node --test`
// -- had to read the domain's own vocabulary instead of restating it.
//
// This step rewrites the emitted output only: `./constants` becomes
// `./constants.js` and `./output-nodes` becomes `./output-nodes/index.js`, in
// both the `.js` and the `.d.ts` files. `domain/src` is untouched, so every
// bundler consumer resolves exactly what it resolved before. Core solves the
// same problem one step earlier in the pipeline, with
// `scripts/rewrite-declaration-imports.mjs`; Core's sources carry explicit
// `.ts` extensions, so its rewrite is a substitution, while this one has to
// resolve each specifier against the emitted tree.
//
// An unresolvable specifier throws. A silently half-rewritten `dist/` would
// fail only in the consumer, long after the build reported success.

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const RELATIVE_SPECIFIER = /((?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["']))(\.\.?(?:\/[^"']*)?)\2/g;
const ALREADY_EXPLICIT = /\.(?:js|mjs|cjs|json|node)$/;

const outputRoot = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, "..", "dist"));
const emitted = new Set(await emittedFiles(outputRoot));
let rewrittenFiles = 0;
let rewrittenSpecifiers = 0;

for (const filePath of emitted) {
  if (!filePath.endsWith(".js") && !filePath.endsWith(".d.ts")) continue;
  const source = await readFile(filePath, "utf8");
  const directory = path.dirname(filePath);
  let rewrites = 0;
  const rewritten = source.replace(RELATIVE_SPECIFIER, (match, prefix, quote, specifier) => {
    if (ALREADY_EXPLICIT.test(specifier)) return match;
    rewrites += 1;
    return `${prefix}${resolveSpecifier(directory, specifier, filePath)}${quote}`;
  });
  if (rewrites === 0) continue;
  await writeFile(filePath, rewritten, "utf8");
  rewrittenFiles += 1;
  rewrittenSpecifiers += rewrites;
}

console.log(`rewrite-dist-specifiers: ${rewrittenSpecifiers} specifier(s) in ${rewrittenFiles} file(s) under ${path.relative(process.cwd(), outputRoot) || "."}`);

/** The specifier rewritten as a path Node ESM can load, resolved against what was actually emitted. */
function resolveSpecifier(directory, specifier, filePath) {
  const target = path.resolve(directory, specifier);
  if (emitted.has(`${target}.js`)) return `${specifier}.js`;
  if (emitted.has(path.join(target, "index.js"))) return `${specifier.replace(/\/+$/, "")}/index.js`;
  throw new Error(`rewrite-dist-specifiers: "${specifier}" in ${filePath} resolves to neither ${target}.js nor ${path.join(target, "index.js")}. The build output is incomplete.`);
}

async function emittedFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await emittedFiles(target)));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}
