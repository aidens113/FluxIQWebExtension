// A resource's bytes as the base64 the capture's reply carries them in.
// `btoa` takes a binary string, built here a slice at a time: one
// `String.fromCharCode` over a whole image would pass millions of arguments.

/** Bytes per `String.fromCharCode` call, under every engine's argument limit. */
const SLICE_BYTES = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let start = 0; start < bytes.length; start += SLICE_BYTES) {
    binary += String.fromCharCode(...bytes.subarray(start, start + SLICE_BYTES));
  }
  return btoa(binary);
}
