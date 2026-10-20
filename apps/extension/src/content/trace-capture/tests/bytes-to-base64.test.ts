// Base64 of a resource's bytes, across the slices the encoder builds it in.

import assert from "node:assert/strict";
import test from "node:test";
import { bytesToBase64 } from "../bytes-to-base64";

test("bytes of every value, across several slices, encode as Node's own base64 does", () => {
  const bytes = new Uint8Array(0x8000 * 2 + 17).map((_, index) => (index * 31 + 7) % 256);
  assert.equal(bytesToBase64(bytes), Buffer.from(bytes).toString("base64"));
});

test("no bytes encode as the empty string", () => {
  assert.equal(bytesToBase64(new Uint8Array(0)), "");
});
