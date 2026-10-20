// Whether stored bytes hold any of the secrets a caller has, searched in
// process: as UTF-8 and as UTF-16LE, the two encodings a JSON event or a page
// document could carry it in. Only the yes or no leaves; the secrets are never
// printed, logged or returned.

/** True when `content` holds any secret, in UTF-8 or UTF-16LE. Empty secrets are ignored. */
export function holdsAnySecret(content: Uint8Array | string, secrets: readonly string[]): boolean {
  const haystack = typeof content === "string" ? Buffer.from(content, "utf8") : Buffer.from(content.buffer, content.byteOffset, content.byteLength);
  for (const secret of secrets) {
    if (secret.length === 0) continue;
    if (haystack.includes(Buffer.from(secret, "utf8")) || haystack.includes(Buffer.from(secret, "utf16le"))) return true;
  }
  return false;
}
