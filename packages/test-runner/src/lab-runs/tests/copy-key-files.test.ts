import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { copyKeyFiles } from "../copy-key-files.js";

/**
 * The central folder is where a gate reader looks first. A repair lane's
 * record, the run's adaptation measurements and the created Flow's identity are
 * the gate's evidence (adaptation plan P4-P6), so they are copied with the
 * verdict rather than left only in the bundle (run-mv6v2g3l-a865ead7, G-b).
 */
test("the gate's evidence is copied into the central folder beside the verdict", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "copy-key-files-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bundle = path.join(root, "bundle");
  const folder = path.join(root, "central");
  const snapshots = ["repair-lane.json", "adaptation.json", "creation-context.json", "flow-lane.json"];
  await mkdir(path.join(bundle, "snapshots"), { recursive: true });
  for (const name of snapshots) await writeFile(path.join(bundle, "snapshots", name), JSON.stringify({ name }));
  await writeFile(path.join(bundle, "evaluation.json"), "{}");
  // A bundle file the central folder does not keep stays where it is.
  await writeFile(path.join(bundle, "snapshots", "extraction-mismatches.json"), "{}");

  const lines: string[] = [];
  const copied = await copyKeyFiles(bundle, folder, (line) => lines.push(line));

  for (const name of snapshots) assert.ok(copied.includes(`snapshots/${name}`), `snapshots/${name} is copied`);
  assert.equal(JSON.parse(await readFile(path.join(folder, "snapshots", "repair-lane.json"), "utf8")).name, "repair-lane.json");
  assert.equal(copied.includes("snapshots/extraction-mismatches.json"), false);
  assert.deepEqual(lines, []);
});

test("a run that wrote none of the gate's evidence copies what it has and names no failure", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "copy-key-files-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bundle = path.join(root, "bundle");
  await mkdir(bundle, { recursive: true });
  await writeFile(path.join(bundle, "summary.json"), "{}");
  const lines: string[] = [];
  assert.deepEqual(await copyKeyFiles(bundle, path.join(root, "central"), (line) => lines.push(line)), ["summary.json"]);
  assert.deepEqual(lines, []);
});
