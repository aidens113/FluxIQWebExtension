// RFC 6455 framing, read-only: enough for the relay to see whole messages and
// pass each one on as the exact bytes it arrived as, or not at all.

/** One frame, its payload unmasked for reading, and the exact bytes it arrived as for forwarding. */
export type WebSocketFrame = { fin: boolean; compressed: boolean; opcode: number; payload: Buffer; bytes: Buffer };

/**
 * A complete unit to forward or drop: a data message with every frame it was
 * fragmented into, or a single control frame (close, ping, pong), which may
 * arrive between a message's fragments and is passed on at once.
 */
export type WebSocketUnit =
  | { kind: "message"; frames: WebSocketFrame[]; compressed: boolean; text: string | undefined }
  | { kind: "control"; frames: [WebSocketFrame] };

const TEXT = 0x1;
const CONTINUATION = 0x0;

/** Reads frames from one direction of a socket, chunk by chunk, and hands back whole units in order. */
export class WebSocketUnitReader {
  private buffer: Buffer = Buffer.alloc(0);
  private pending: WebSocketFrame[] = [];

  push(chunk: Buffer): WebSocketUnit[] {
    this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
    const units: WebSocketUnit[] = [];
    for (let frame = readFrame(this.buffer); frame; frame = readFrame(this.buffer)) {
      this.buffer = this.buffer.subarray(frame.bytes.length);
      if (frame.opcode >= 0x8) { units.push({ kind: "control", frames: [frame] }); continue; }
      this.pending.push(frame);
      if (!frame.fin) continue;
      const frames = this.pending;
      this.pending = [];
      const first = frames[0]!;
      const compressed = first.compressed;
      const text = first.opcode === TEXT && !compressed ? Buffer.concat(frames.map(item => item.payload)).toString("utf8") : undefined;
      units.push({ kind: "message", frames, compressed, text });
    }
    return units;
  }
}

/** One complete frame at the start of `buffer`, or undefined while it has not all arrived. */
function readFrame(buffer: Buffer): WebSocketFrame | undefined {
  if (buffer.length < 2) return undefined;
  const first = buffer[0]!;
  const second = buffer[1]!;
  const masked = (second & 0x80) !== 0;
  let length = second & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < 4) return undefined;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buffer.length < 10) return undefined;
    const declared = buffer.readBigUInt64BE(2);
    if (declared > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("A WebSocket frame declared a length no relay can hold");
    length = Number(declared);
    offset = 10;
  }
  const maskAt = offset;
  if (masked) offset += 4;
  const end = offset + length;
  if (buffer.length < end) return undefined;
  const payload = Buffer.from(buffer.subarray(offset, end));
  if (masked) for (let index = 0; index < payload.length; index += 1) payload[index] = payload[index]! ^ buffer[maskAt + (index % 4)]!;
  const opcode = first & 0x0f;
  return { fin: (first & 0x80) !== 0, compressed: (first & 0x40) !== 0 && opcode !== CONTINUATION, opcode, payload, bytes: buffer.subarray(0, end) };
}
