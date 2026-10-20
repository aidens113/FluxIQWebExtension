// The resources a serialized document refers to, carried as base64 under the
// capture's bounds (`capture-bounds.ts`), in the order the document refers to
// them.
//
// A fetched resource comes as the server's bytes (`fetch-resource-bytes.ts`);
// a frame document serialized here, as its UTF-8 text. Each one counts toward
// the per-resource and total byte bounds alike. A resource that fails, times
// out, would pass a bound, or is not reached before the deadline is counted in
// `unavailable` and left out, so the reply says how much of the page it does
// not hold rather than holding less without saying.
//
// A stylesheet or frame document carried here can itself refer to things
// through CSS `url()` -- fonts, background images, cursors -- which the
// capture does not fetch. Each distinct address such a carried resource
// refers to, that is not one of the resources being carried, is counted in
// `unavailable` too. `@import` is left to the serializer, which already lists
// each import as a resource of its own; `data:` and in-document `#fragment`
// references need nothing fetched.

import { bytesToBase64 } from "./bytes-to-base64";
import { fetchResourceBytes } from "./fetch-resource-bytes";
import type { TracePageCaptureResource } from "../../shared/trace-page-capture";
import type { ResourceFetcher, TraceCaptureBounds, TraceResourceReference } from "./types";

/** A CSS `url()` token: its address quoted either way or bare. */
const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]*))\s*\)/giu;

/** An `@import` statement, whose address the serializer already carries as a resource. */
const CSS_IMPORT = /@import\s[^;]*;?/giu;

/** Addresses a `url()` may hold that need no request: inline data, the document's own fragments, and nothing. */
const NEEDS_NO_REQUEST = /^(?:data:|blob:|about:|javascript:|#|$)/iu;

/** Media types whose text may hold CSS `url()` references. */
const CSS_BEARING = /^(?:text\/css|text\/html)\b/iu;

export async function carryResources(
  references: readonly TraceResourceReference[],
  bounds: TraceCaptureBounds,
  fetchBytes: ResourceFetcher = fetchResourceBytes
): Promise<{ resources: TracePageCaptureResource[]; unavailable: number }> {
  const deadline = Date.now() + bounds.captureDeadlineMs;
  const carried: Array<TracePageCaptureResource | undefined> = [];
  let total = 0;
  let unavailable = 0;
  let next = 0;
  const carriedSources = new Set(references.map((reference) => reference.source));
  const uncarriedUrls = new Set<string>();
  const keep = (index: number, source: string, mediaType: string, bytes: Uint8Array): void => {
    if (bytes.length > bounds.resourceBytes || total + bytes.length > bounds.totalResourceBytes) {
      unavailable += 1;
      return;
    }
    total += bytes.length;
    carried[index] = { source, mediaType, base64: bytesToBase64(bytes) };
    if (CSS_BEARING.test(mediaType)) {
      for (const address of cssUrlAddresses(new TextDecoder().decode(bytes), source)) {
        if (!carriedSources.has(address)) uncarriedUrls.add(address);
      }
    }
  };
  const work = async (): Promise<void> => {
    for (let index = next++; index < references.length; index = next++) {
      const reference = references[index] as TraceResourceReference;
      if (reference.kind === "inline") {
        keep(index, reference.source, reference.mediaType, new TextEncoder().encode(reference.text));
        continue;
      }
      const remainingMs = deadline - Date.now();
      const room = Math.min(bounds.resourceBytes, bounds.totalResourceBytes - total);
      if (remainingMs <= 0 || room <= 0) {
        unavailable += 1;
        continue;
      }
      const fetched = await fetchBytes(reference.source, { maxBytes: room, timeoutMs: Math.min(bounds.fetchTimeoutMs, remainingMs) });
      if (fetched.carried) keep(index, reference.source, fetched.mediaType, fetched.bytes);
      else unavailable += 1;
    }
  };
  const workers = Math.max(1, Math.min(bounds.fetchConcurrency, references.length));
  await Promise.all(Array.from({ length: workers }, work));
  return { resources: carried.filter((resource): resource is TracePageCaptureResource => resource !== undefined), unavailable: unavailable + uncarriedUrls.size };
}

/** The absolute address of each `url()` a stylesheet or document refers to, resolved against where it came from; `@import` and addresses needing no request left out. */
function cssUrlAddresses(text: string, base: string): string[] {
  const addresses: string[] = [];
  for (const match of text.replace(CSS_IMPORT, "").matchAll(CSS_URL)) {
    const written = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (NEEDS_NO_REQUEST.test(written)) continue;
    const address = absoluteAddress(written, base);
    if (address !== undefined && !NEEDS_NO_REQUEST.test(address)) addresses.push(address);
  }
  return addresses;
}

/** The address made absolute, or `undefined` when it cannot be (`new URL` throws `TypeError`): nothing could request it either. */
function absoluteAddress(address: string, base: string): string | undefined {
  try {
    return new URL(address, base).href;
  } catch (error) {
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}
