// Some rows in this folder assert on the module's own text rather than on what
// it returns: the order two seams run in, a selector that must still be exact,
// a literal that must never reappear. The subject is a directory now, so "the
// module's source" is every file in it concatenated in a stable order --
// reading one file would silently stop covering whatever moved to a sibling,
// and a `doesNotMatch` row that reads less text is a row that stopped failing.
//
// Two readings, because the rows want two different things. The TypeScript
// source is what a reviewer edits; the compiled output is what actually ran.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

async function concatenatedFiles(directory: string, extension: string): Promise<string> {
  const names = (await readdir(directory)).filter(name => name.endsWith(extension)).sort();
  const contents = await Promise.all(names.map(name => readFile(path.join(directory, name), "utf8")));
  return contents.join("\n");
}

// Every `.ts` file of `packages/test-runner/src/demo-llm-create-ui/`, excluding
// this tests folder, which `readdir` does not descend into.
export async function readCreateUiSource(): Promise<string> {
  return concatenatedFiles(path.resolve(import.meta.dirname, "..", "..", "..", "..", "..", "packages", "test-runner", "src", "demo-llm-create-ui"), ".ts");
}

// Every compiled `.js` file of the same directory, beside this folder in dist.
export async function readCreateUiBuildOutput(): Promise<string> {
  return concatenatedFiles(path.resolve(import.meta.dirname, ".."), ".js");
}
