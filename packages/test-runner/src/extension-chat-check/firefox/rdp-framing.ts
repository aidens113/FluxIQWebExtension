/**
 * Splits bytes read from Firefox's remote debugging protocol into packets.
 *
 * Each packet is `<byte length>:<JSON>`, the length counting UTF-8 bytes of
 * the JSON that follows. A read may end part-way through a packet, so what is
 * left is handed back to be prefixed to the next read. Bulk packets (`bulk ...`)
 * are never sent to the requests this probe makes, and are refused.
 */
export function readRdpFrames(buffer: Buffer): { packets: unknown[]; rest: Buffer } {
  const packets: unknown[] = [];
  let offset = 0;
  for (;;) {
    const colon = buffer.indexOf(0x3a, offset);
    if (colon < 0) break;
    const header = buffer.subarray(offset, colon).toString("ascii");
    if (!/^\d+$/u.test(header)) throw new Error(`Firefox sent a packet header that is not a length: ${JSON.stringify(header.slice(0, 20))}`);
    const length = Number(header);
    const start = colon + 1;
    if (buffer.byteLength < start + length) break;
    packets.push(JSON.parse(buffer.subarray(start, start + length).toString("utf8")));
    offset = start + length;
  }
  return { packets, rest: buffer.subarray(offset) };
}
