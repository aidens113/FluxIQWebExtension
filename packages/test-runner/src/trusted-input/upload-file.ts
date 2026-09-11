import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Locator } from "@playwright/test";
import { RunnerFailure } from "../failure.js";

export type DeterministicUpload = { fileName: string; bytes: number; sha256: string };

const SAFE_FILE_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9._ -]{0,126}[A-Za-z0-9])?$/u;
const WINDOWS_DEVICE_NAME = /^(?:con|prn|aux|nul|clock\$|com[1-9]|lpt[1-9])(?:\..*)?$/iu;

/** The bytes a deterministic upload named `fileName` carries: they depend on the name only. */
export function deterministicUploadBytes(fileName: string): Buffer {
  return Buffer.from(`FluxIQ deterministic upload\nfile: ${fileName}\n`, "utf8");
}

/**
 * Sets a file input to a file named `fileName` with deterministic bytes. The
 * bytes are written under `directory` and handed over by path: Playwright
 * applies a path through the browser, which dispatches trusted `input` and
 * `change` events, whereas an in-memory buffer is applied by page script and
 * its events are untrusted, which the recorder ignores.
 */
export async function uploadDeterministicFile(control: Locator, fileName: string, directory: string, options: { timeoutMs?: number } = {}): Promise<DeterministicUpload> {
  if (!SAFE_FILE_NAME.test(fileName) || WINDOWS_DEVICE_NAME.test(fileName)) {
    throw new RunnerFailure("fixture.invalid", "Upload file name must be one portable path segment", { details: { fileName } });
  }
  const bytes = deterministicUploadBytes(fileName);
  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, fileName);
  await writeFile(filePath, bytes);
  await control.setInputFiles(filePath, options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs });
  return { fileName, bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
}
