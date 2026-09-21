/**
 * Rolefinch's job key for a posting: sixteen lowercase hex characters, the
 * shape a job board keys its postings by. It is derived from the posting's
 * authored id so it never depends on the lab seed: a key is the job's
 * identity, the way a URL is, and a Flow may rely on it exactly as far as a
 * person bookmarking the job could. The hash is mixed until neighbouring ids
 * give unrelated keys, as real ones look.
 */
export function jobKey(id: string): string {
  return `${mixed(`rolefinch:${id}`, 0x811c9dc5)}${mixed(`jk:${id}`, 0x9e3779b9)}`;
}

function mixed(text: string, seed: number): string {
  let value = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35) >>> 0;
  value ^= value >>> 16;
  return (value >>> 0).toString(16).padStart(8, "0");
}
