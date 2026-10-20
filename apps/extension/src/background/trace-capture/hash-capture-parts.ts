// A page capture's parts as artifacts: the document (UTF-8, `text/html`, the
// primary artifact) and each resource it carried (its bytes from base64, its
// media type as the server sent it), each addressed by its SHA-256.
//
// A resource whose base64 cannot be read is left out and counted, so the
// result says how much of the page it does not hold.

import type { TracePageCaptureResponse } from "../../shared/trace-page-capture";
import type { HashedTraceArtifact } from "./types";
import { sha256Hex } from "./sha256-hex";

/** The media type the document is stored and served as. */
const DOCUMENT_MEDIA_TYPE = "text/html";

export async function hashCaptureParts(reply: Extract<TracePageCaptureResponse, { ok: true }>): Promise<{ parts: HashedTraceArtifact[]; unreadable: number }> {
  const documentBytes = new TextEncoder().encode(reply.document.html);
  const parts: HashedTraceArtifact[] = [{
    sha256: await sha256Hex(documentBytes),
    mediaType: DOCUMENT_MEDIA_TYPE,
    byteLength: documentBytes.byteLength,
    role: "primary",
    source: reply.document.source,
    bytes: documentBytes
  }];
  let unreadable = 0;
  for (const resource of reply.resources) {
    const bytes = bytesFromBase64(resource.base64);
    if (bytes === undefined) {
      unreadable += 1;
      continue;
    }
    parts.push({ sha256: await sha256Hex(bytes), mediaType: resource.mediaType, byteLength: bytes.byteLength, role: "resource", source: resource.source, bytes });
  }
  return { parts, unreadable };
}

/** The bytes a base64 string holds, or `undefined` when it is not base64 (`atob` throws `InvalidCharacterError`). */
function bytesFromBase64(base64: string): Uint8Array<ArrayBuffer> | undefined {
  let binary: string;
  try {
    binary = atob(base64);
  } catch (error) {
    if (error instanceof DOMException && error.name === "InvalidCharacterError") return undefined;
    throw error;
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
