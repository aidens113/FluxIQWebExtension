// Which list a read reads, as the site's structure says it (invariant I3 of the result and evidence design).
//
// A list is its item selector, the container it sits in and the frame it is in: nothing the model
// wrote, no handle (a detection after a redraw numbers one afresh), no page address and no row. So two
// detections of one list that redrew between them are one list, and two lists of one page are two. The
// frame is named by its document's path where it has one, since a frame's number is given anew by a
// reload, and by its number where the path was not known.
//
// The digest is 106 bits from two independent 53-bit string hashes, computed here without a platform
// call because this module is bundled into the browser extension.

/** What a list is made of. `container` is absent where the detection named none. */
export type WebAutomationExtractListKeyParts = {
  item: string;
  container?: string | undefined;
  frameId?: number | undefined;
  frameUrlPath?: string | undefined;
};

/** A stable, opaque key for the list the parts name. */
export function webAutomationExtractListKey(parts: WebAutomationExtractListKeyParts): string {
  const frame = parts.frameUrlPath !== undefined && parts.frameUrlPath !== "" ? `path:${parts.frameUrlPath}` : parts.frameId !== undefined && parts.frameId > 0 ? `id:${parts.frameId}` : "top";
  const said = [parts.item.trim(), (parts.container ?? "").trim(), frame].join("\0");
  return `list.${hash(said, 0x9e3779b9)}${hash(said, 0x85ebca6b)}`;
}

/** cyrb53: a 53-bit hash of a string under a seed, as 14 hex digits. */
function hash(text: string, seed: number): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}
