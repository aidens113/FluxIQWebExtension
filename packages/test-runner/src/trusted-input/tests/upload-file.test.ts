import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { Locator } from "@playwright/test";
import { RunnerFailure } from "../../failure.js";
import { deterministicUploadBytes, uploadDeterministicFile } from "../upload-file.js";

function fakeFileInput() {
  const received: unknown[] = [];
  const control = { setInputFiles: async (files: unknown) => { received.push(files); } } as unknown as Locator;
  return { control, received };
}

test("hands the browser a path to a file named by the step, so its input and change events are trusted", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fluxiq-upload-"));
  try {
    const { control, received } = fakeFileInput();
    const upload = await uploadDeterministicFile(control, "report-101.csv", directory);
    const filePath = path.join(directory, "report-101.csv");
    assert.deepEqual(received, [filePath]);
    const bytes = await readFile(filePath);
    assert.deepEqual(bytes, deterministicUploadBytes("report-101.csv"));
    assert.equal(upload.bytes, bytes.byteLength);
    assert.equal(upload.sha256, createHash("sha256").update(bytes).digest("hex"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the same name always yields the same bytes", () => {
  assert.deepEqual(deterministicUploadBytes("a.txt"), deterministicUploadBytes("a.txt"));
  assert.notDeepEqual(deterministicUploadBytes("a.txt"), deterministicUploadBytes("b.txt"));
});

test("rejects names that are not one portable path segment", async () => {
  const { control, received } = fakeFileInput();
  for (const name of ["", "../escape.txt", "nested/file.txt", "con.txt", "trailing.", " leading.txt"]) {
    await assert.rejects(uploadDeterministicFile(control, name, os.tmpdir()), (error: unknown) => error instanceof RunnerFailure && error.category === "fixture.invalid", name);
  }
  assert.deepEqual(received, []);
});
