import { readFile } from "node:fs/promises";
import { assertEagerBundle } from "./assert-eager-bundle.mjs";

/**
 * `assertEagerBundle` for a bundle already written to disk.
 *
 * @param {string} label what was built, named in the message
 * @param {readonly string[]} files the bundle's JavaScript output files
 */
export async function assertEagerFiles(label, files) {
  const bundles = [];
  for (const file of files) bundles.push({ file, text: await readFile(file, "utf8") });
  assertEagerBundle(label, bundles);
}
