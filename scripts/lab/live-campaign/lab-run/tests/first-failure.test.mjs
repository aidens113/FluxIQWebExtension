import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { withTemp } from "../../tests/temp-directory.mjs";
import { readFirstFailure } from "../first-failure.mjs";

test("the first failure is read from the run's summary.json", async () => {
  await withTemp(async (directory) => {
    await mkdir(path.join(directory, "run-a"));
    await writeFile(path.join(directory, "run-a", "summary.json"), JSON.stringify({ firstFailure: { sequence: 1, summary: "  Core did not become ready \n" } }));
    assert.equal(readFirstFailure(path.join(directory, "run-a")), "Core did not become ready");
  });
});

test("a run with no summary, or a summary with no first failure, has none", async () => {
  await withTemp(async (directory) => {
    assert.equal(readFirstFailure(path.join(directory, "absent")), null);
    await mkdir(path.join(directory, "run-b"));
    await writeFile(path.join(directory, "run-b", "summary.json"), JSON.stringify({ firstFailure: null }));
    assert.equal(readFirstFailure(path.join(directory, "run-b")), null);
  });
});
