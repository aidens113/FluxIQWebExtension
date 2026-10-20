// An artifact's address: the SHA-256 of its bytes in lower-case hex, the
// digest Core's trace store checks (`client-gateway/trace/artifact-digest.ts`
// in FluxIQ Core) and the one `connection/state-assets.ts` computes.

export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
