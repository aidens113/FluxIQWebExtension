import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { unpackedExtensionId } from "../extension-readiness.js";

test("an unpacked extension's id is its path's SHA-256, first 32 hex digits mapped onto a-p", () => {
  const extensionPath = ["C:", "runs", "ui-e2e", "r1", "extension-under-test"].join("\\");
  const id = unpackedExtensionId(extensionPath, "win32");
  assert.match(id, /^[a-p]{32}$/u);
  const digest = createHash("sha256").update(Buffer.from(extensionPath, "utf16le")).digest("hex");
  assert.equal(id, [...digest.slice(0, 32)].map((digit) => String.fromCharCode(97 + Number.parseInt(digit, 16))).join(""));
  // Windows hashes UTF-16LE and other platforms UTF-8, so the same text names different ids.
  assert.notEqual(unpackedExtensionId(extensionPath, "linux"), id);
});
