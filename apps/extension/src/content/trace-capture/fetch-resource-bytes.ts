// One resource the capture carries, fetched as the bytes the server sends for
// it: an image's own JPEG or WebP rather than a PNG re-encoded through a
// canvas (which the spike measured at several times the size and which is not
// the resource the page loaded), a stylesheet's own text rather than the
// CSSOM's restatement of it.
//
// The fetch is the page's own kind of request, same-origin with the page's
// credentials, and asks the browser's cache first, so a resource the page
// already loaded is usually answered without another trip to the server. It is
// bounded twice: a declared length past `maxBytes` is refused before the body
// is read, and a body is read a chunk at a time and abandoned the moment it
// passes `maxBytes`, since a compressed response declares its compressed length.
//
// It never rejects: every way a fetch can fail is an answer saying which.

import type { ResourceFetcher } from "./types";

/** The media type a resource is served as when its server named none. */
const UNNAMED_MEDIA_TYPE = "application/octet-stream";

export const fetchResourceBytes: ResourceFetcher = async (address, { maxBytes, timeoutMs }) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(address, { credentials: "same-origin", cache: "force-cache", signal: controller.signal });
    if (!response.ok) {
      await response.body?.cancel();
      return { carried: false, why: "status" };
    }
    const declared = Number(response.headers.get("content-length") ?? "");
    if (Number.isFinite(declared) && declared > maxBytes) {
      await response.body?.cancel();
      return { carried: false, why: "too-large" };
    }
    const bytes = await readWithin(response, maxBytes);
    if (bytes === "too-large") return { carried: false, why: "too-large" };
    return { carried: true, mediaType: response.headers.get("content-type")?.trim() || UNNAMED_MEDIA_TYPE, bytes };
  } catch (error) {
    return { carried: false, why: wasAborted(error, controller) ? "timeout" : "failed" };
  } finally {
    clearTimeout(timer);
  }
};

/** Whether the failure is the timeout's abort rather than the request's own. */
function wasAborted(error: unknown, controller: AbortController): boolean {
  return controller.signal.aborted && error instanceof DOMException && error.name === "AbortError";
}

async function readWithin(response: Response, maxBytes: number): Promise<Uint8Array | "too-large"> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    length += read.value.length;
    if (length > maxBytes) {
      await reader.cancel();
      return "too-large";
    }
    chunks.push(read.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
